export type ContributionType = "Pull Request" | "Push" | "Issue" | "Issue Comment" | "Release";

export type Contribution = {
  project: string;
  type: ContributionType;
  date: string;
  summary: string;
  url: string;
};

export type GitHubActor = {
  login?: string;
};

export type GitHubRepo = {
  name?: string;
};

export type GitHubPullRequest = {
  title?: string;
  html_url?: string;
};

export type GitHubIssue = {
  title?: string;
  html_url?: string;
};

export type GitHubRelease = {
  html_url?: string;
  tag_name?: string;
};

export type GitHubEventPayload = {
  action?: string;
  commits?: Array<{ message?: string }>;
  pull_request?: GitHubPullRequest;
  issue?: GitHubIssue;
  comment?: { html_url?: string };
  release?: GitHubRelease;
  ref_type?: string;
  ref?: string;
};

export type GitHubEvent = {
  type?: string;
  repo?: GitHubRepo;
  actor?: GitHubActor;
  created_at?: string;
  payload?: GitHubEventPayload;
};

