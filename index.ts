import type { GitHubEvent, Contribution } from "./type";

const PORT = Number(process.env.PORT ?? 3000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

type GitHubRepoMetadata = {
  ownerLogin: string;
  isFork: boolean;
};

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

function safePublicPath(url: URL): string | null {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const decoded = decodeURIComponent(pathname);

  if (decoded.includes("..")) {
    return null;
  }

  return `./public${decoded}`;
}

function contentTypeFromPath(path: string): string {
  const extensionIndex = path.lastIndexOf(".");
  if (extensionIndex === -1) {
    return "application/octet-stream";
  }

  const extension = path.slice(extensionIndex);
  return contentTypes[extension] ?? "application/octet-stream";
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function getRepoOwner(repoFullName: string): string {
  const [owner] = repoFullName.split("/");
  return (owner ?? "").toLowerCase();
}

function toContribution(event: GitHubEvent): Contribution | null {
  const type = event.type;
  const date = event.created_at;
  const repo = event.repo?.name;
  const payload = event.payload;

  if (!type || !date || !repo || !payload) {
    return null;
  }

  if (type === "PullRequestEvent") {
    const pr = payload.pull_request;
    const prUrl = pr?.html_url;

    if (!pr || !prUrl) {
      return null;
    }

    return {
      project: repo,
      type: "Pull Request",
      date,
      summary: `${payload.action ?? "updated"} PR: ${pr.title ?? "No title"}`,
      url: prUrl,
    };
  }

  if (type === "PushEvent") {
    const commits = payload.commits ?? [];
    const firstMessage = commits[0]?.message ?? "Pushed commits";

    return {
      project: repo,
      type: "Push",
      date,
      summary: `${commits.length} commit(s): ${firstMessage}`,
      url: `https://github.com/${repo}`,
    };
  }

  if (type === "IssuesEvent") {
    const issue = payload.issue;
    const issueUrl = issue?.html_url;

    if (!issue || !issueUrl) {
      return null;
    }

    return {
      project: repo,
      type: "Issue",
      date,
      summary: `${payload.action ?? "updated"} issue: ${issue.title ?? "No title"}`,
      url: issueUrl,
    };
  }

  if (type === "IssueCommentEvent") {
    const issue = payload.issue;
    const commentUrl = payload.comment?.html_url;

    if (!issue || !commentUrl) {
      return null;
    }

    return {
      project: repo,
      type: "Issue Comment",
      date,
      summary: `Commented on issue: ${issue.title ?? "No title"}`,
      url: commentUrl,
    };
  }

  if (type === "ReleaseEvent") {
    const release = payload.release;
    const releaseUrl = release?.html_url;

    if (!release || !releaseUrl) {
      return null;
    }

    return {
      project: repo,
      type: "Release",
      date,
      summary: `Published release ${release.tag_name ?? "(untitled)"}`,
      url: releaseUrl,
    };
  }

  return null;
}

async function fetchFromGitHubWithFallback(url: string): Promise<Response> {
  const baseHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bun-contribution-showcase",
  };

  if (!GITHUB_TOKEN) {
    return fetch(url, { headers: baseHeaders });
  }

  const authHeaders = {
    ...baseHeaders,
    Authorization: `Bearer ${GITHUB_TOKEN}`,
  };

  let response = await fetch(url, { headers: authHeaders });

  if (response.status === 401) {
    response = await fetch(url, { headers: baseHeaders });
  }

  return response;
}

async function fetchGitHubEvents(username: string): Promise<Response> {
  const eventsUrl = `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`;
  return fetchFromGitHubWithFallback(eventsUrl);
}

async function fetchRepoMetadata(repoFullName: string): Promise<GitHubRepoMetadata | null> {
  const repoUrl = `https://api.github.com/repos/${repoFullName}`;
  const response = await fetchFromGitHubWithFallback(repoUrl);

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    owner?: { login?: string };
    fork?: boolean;
  };

  return {
    ownerLogin: normalizeUsername(payload.owner?.login ?? getRepoOwner(repoFullName)),
    isFork: payload.fork === true,
  };
}

async function filterExternalNonForkedContributions(
  contributions: Contribution[],
  username: string,
): Promise<Contribution[]> {
  const normalizedUsername = normalizeUsername(username);
  const externalByOwner = contributions.filter(
    (item) => getRepoOwner(item.project) !== normalizedUsername,
  );

  const uniqueRepos = [...new Set(externalByOwner.map((item) => item.project))];
  const metadataEntries = await Promise.all(
    uniqueRepos.map(async (repoName) => [repoName, await fetchRepoMetadata(repoName)] as const),
  );
  const metadataMap = new Map(metadataEntries);

  return externalByOwner.filter((item) => {
    const metadata = metadataMap.get(item.project);

    if (metadata?.ownerLogin === normalizedUsername) {
      return false;
    }

    if (metadata?.isFork === true) {
      return false;
    }

    return true;
  });
}

async function handleContributionApi(url: URL): Promise<Response> {
  const username = (url.searchParams.get("username") ?? "").trim();
  const limitParam = Number(url.searchParams.get("limit") ?? "12");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(30, Math.trunc(limitParam)))
    : 12;

  if (!username) {
    return jsonResponse({ error: "Missing username query parameter." }, 400);
  }

  const githubResponse = await fetchGitHubEvents(username);

  const rateLimitRemaining = githubResponse.headers.get("x-ratelimit-remaining");
  const rateLimitReset = githubResponse.headers.get("x-ratelimit-reset");

  if (!githubResponse.ok) {
    const errorBody = (await githubResponse.text()).slice(0, 200);
    const hint =
      githubResponse.status === 401
        ? "Invalid or expired GITHUB_TOKEN. Remove it or set a valid token."
        : undefined;

    return jsonResponse(
      {
        error: `GitHub API request failed (${githubResponse.status}).`,
        details: errorBody,
        hint,
      },
      githubResponse.status,
    );
  }

  const body = (await githubResponse.json()) as unknown;
  const events = Array.isArray(body) ? (body as GitHubEvent[]) : [];

  const mappedContributions = events
    .map(toContribution)
    .filter((item): item is Contribution => item !== null);

  const filteredContributions = await filterExternalNonForkedContributions(
    mappedContributions,
    username,
  );

  const contributions = filteredContributions.slice(0, limit);

  return jsonResponse({
    username,
    count: contributions.length,
    contributions,
    rate_limit: {
      remaining: rateLimitRemaining,
      reset_unix: rateLimitReset,
    },
  });
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contributions") {
      return handleContributionApi(url);
    }

    const path = safePublicPath(url);

    if (!path) {
      return new Response("Bad request", { status: 400 });
    }

    const file = Bun.file(path);

    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(file, {
      headers: {
        "Content-Type": contentTypeFromPath(path),
        "Cache-Control": "no-cache",
      },
    });
  },
});

console.log(`Contribution page running at http://localhost:${PORT}`);
