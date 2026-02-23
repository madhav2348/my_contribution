import type { Contribution } from "./type";

const USERNAME = "madhav2348";
const OUTPUT_PATH = "./public/data/contributions.json";
const MAX_RESULTS = 100;

type SearchItem = {
  html_url?: string;
  title?: string;
  repository_url?: string;
  pull_request?: {
    url?: string;
  };
};

type PullRequestResponse = {
  merged_at?: string | null;
  html_url?: string;
  title?: string;
  base?: {
    repo?: {
      full_name?: string;
      owner?: {
        login?: string;
      };
    };
  };
};

type StaticContributionPayload = {
  username: string;
  generatedAt: string;
  count: number;
  contributions: Contribution[];
};

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function ownerFromRepositoryUrl(repositoryUrl: string): string {
  const marker = "/repos/";
  const markerIndex = repositoryUrl.indexOf(marker);

  if (markerIndex === -1) {
    return "";
  }

  const fullName = repositoryUrl.slice(markerIndex + marker.length);
  const [owner] = fullName.split("/");
  return normalizeUsername(owner ?? "");
}

async function githubFetchJson<T>(url: string): Promise<T> {
  const baseHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "my-contribution-static-generator",
  };

  const token = process.env.GITHUB_TOKEN?.trim();
  const authHeaders = token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders;
  let response = await fetch(url, { headers: authHeaders });

  if (token && response.status === 401) {
    console.warn("GITHUB_TOKEN is invalid/expired. Retrying without token.");
    response = await fetch(url, { headers: baseHeaders });
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function fetchMergedPrContributions(username: string): Promise<Contribution[]> {
  const normalizedUsername = normalizeUsername(username);
  const query = `type:pr author:${username} is:merged`;
  const searchUrl =
    `https://api.github.com/search/issues?q=${encodeURIComponent(query)}` +
    `&sort=updated&order=desc&per_page=100`;

  const searchResponse = await githubFetchJson<{ items?: SearchItem[] }>(searchUrl);
  const items = Array.isArray(searchResponse.items) ? searchResponse.items.slice(0, MAX_RESULTS) : [];

  const contributionPromises = items.map(async (item) => {
    const repositoryUrl = item.repository_url ?? "";
    const ownerFromSearch = ownerFromRepositoryUrl(repositoryUrl);

    if (!ownerFromSearch || ownerFromSearch === normalizedUsername) {
      return null;
    }

    const pullRequestApiUrl = item.pull_request?.url;
    if (!pullRequestApiUrl) {
      return null;
    }

    const pr = await githubFetchJson<PullRequestResponse>(pullRequestApiUrl);
    const mergedAt = pr.merged_at;
    const baseRepo = pr.base?.repo?.full_name;
    const baseOwner = normalizeUsername(pr.base?.repo?.owner?.login ?? "");

    if (!mergedAt || !baseRepo || !baseOwner || baseOwner === normalizedUsername) {
      return null;
    }

    return {
      project: baseRepo,
      type: "Merged Pull Request",
      date: mergedAt,
      summary: `Merged PR: ${pr.title ?? item.title ?? "Untitled"}`,
      url: pr.html_url ?? item.html_url ?? `https://github.com/${baseRepo}`,
    } satisfies Contribution;
  });

  const contributions = (await Promise.all(contributionPromises)).filter(
    (item): item is Contribution => item !== null,
  );

  contributions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return contributions;
}

async function writeStaticData(payload: StaticContributionPayload): Promise<void> {
  const file = Bun.file(OUTPUT_PATH);
  await Bun.write(file, JSON.stringify(payload, null, 2) + "\n");
}

async function run(): Promise<void> {
  const contributions = await fetchMergedPrContributions(USERNAME);
  const payload: StaticContributionPayload = {
    username: USERNAME,
    generatedAt: new Date().toISOString(),
    count: contributions.length,
    contributions,
  };

  await writeStaticData(payload);
  console.log(`Wrote ${contributions.length} merged PR contribution(s) to ${OUTPUT_PATH}.`);
}

run().catch((error) => {
  console.error("Failed to generate static contributions JSON.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
