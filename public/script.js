const statusEl = document.querySelector("#status");
const listEl = document.querySelector("#contribution-list");

function formatDate(dateText) {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderContributions(contributions) {
  if (!listEl) return;

  if (!contributions.length) {
    listEl.innerHTML = "";
    return;
  }

  listEl.innerHTML = contributions
    .map(
      (item) => `
        <article class="card">
          <h3>${escapeHtml(item.project)}</h3>
          <p class="meta">${escapeHtml(item.type)} - ${escapeHtml(formatDate(item.date))}</p>
          <p>
            <a class="pr-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">
              ${escapeHtml(item.summary)}
            </a>
          </p>
        </article>
      `,
    )
    .join("");
}

async function loadContributions() {
  if (!statusEl || !listEl) return;

  statusEl.textContent = "Loading pre-generated contributions...";
  listEl.innerHTML = "";

  try {
    const response = await fetch("/data/contributions.json", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      statusEl.textContent = payload.error || "Failed to load contributions.";
      return;
    }

    const contributions = Array.isArray(payload.contributions) ? payload.contributions : [];
    renderContributions(contributions);

    if (!contributions.length) {
      statusEl.textContent = "No merged pull requests found in the generated data.";
      return;
    }

    const username = typeof payload.username === "string" ? payload.username : "madhav2348";
    statusEl.textContent = `Showing ${contributions.length} merged pull request(s) for ${username}.`;
  } catch (error) {
    statusEl.textContent = "Unable to load static contribution data.";
  }
}

loadContributions();
