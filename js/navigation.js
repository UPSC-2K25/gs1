
(() => {
  "use strict";

  const SCRIPT_PATH = "js/navigation.js";
  const CONFIG_PATH = "data/navigation.json";

  const scriptElement =
    document.currentScript ||
    document.querySelector(`script[src*="${SCRIPT_PATH}"]`);

  const scriptUrl = scriptElement
    ? new URL(scriptElement.src, window.location.href)
    : new URL(SCRIPT_PATH, window.location.href);

  const SITE_ROOT = new URL("../", scriptUrl);
  const CONFIG_URL = new URL(CONFIG_PATH, SITE_ROOT);

  let config = null;
  let pageContext = null;

  function normalizePath(path) {
    if (!path) return "/";

    let value = String(path).replace(/\\/g, "/");
    value = value.split("?")[0].split("#")[0];
    value = value.replace(/\/+/g, "/");

    if (!value.startsWith("/")) value = `/${value}`;

    if (value.length > 1 && value.endsWith("/")) {
      value = value.slice(0, -1);
    }

    return value;
  }

  function resolveSitePath(path) {
    if (!path) return SITE_ROOT.href;

    const value = String(path);

    if (/^https?:\/\//i.test(value)) return value;

    return new URL(value.replace(/^\/+/, ""), SITE_ROOT).href;
  }

  function currentPath() {
    const rootPath = normalizePath(
      new URL(SITE_ROOT.href).pathname
    );

    const locationPath = normalizePath(
      window.location.pathname
    );

    if (rootPath === "/") return locationPath;

    if (locationPath.startsWith(rootPath)) {
      return normalizePath(
        locationPath.slice(rootPath.length) || "/"
      );
    }

    return locationPath;
  }

  function isCurrentPath(path) {
    return normalizePath(path) === normalizePath(currentPath());
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function createLink(label, path, className) {
    const link = createElement("a", className, label);

    link.href = resolveSitePath(path);

    if (isCurrentPath(path)) {
      link.setAttribute("aria-current", "page");
    }

    return link;
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);

    if (element && value !== undefined && value !== null) {
      element.textContent = value;
    }
  }

  function getOrCreate(selector, parent, tag, className) {
    const existing = document.querySelector(selector);

    if (existing) return existing;

    const element = createElement(tag || "div", className);

    if (parent) parent.appendChild(element);

    return element;
  }

  function getPageContext() {
    const path = currentPath();

    if (path === "/" || path === "/index.html") {
      return {
        type: "home",
        path
      };
    }

    for (const section of config.sections) {
      const sectionPath = normalizePath(section.path);

      if (
        path === sectionPath ||
        path === `${sectionPath}/index.html`
      ) {
        return {
          type: "module",
          section,
          path
        };
      }

      for (
        let index = 0;
        index < section.chapters.length;
        index++
      ) {
        const chapter = section.chapters[index];
        const chapterPath = normalizePath(chapter.path);

        if (
          path === chapterPath ||
          path === `${chapterPath}/index.html`
        ) {
          return {
            type: "chapter",
            section,
            chapter,
            chapterIndex: index,
            path
          };
        }
      }
    }

    return {
      type: "unknown",
      path
    };
  }

  function validateConfig(data) {
    if (!data || typeof data !== "object") {
      throw new Error(
        "Navigation configuration is missing or invalid."
      );
    }

    if (!data.site || !Array.isArray(data.sections)) {
      throw new Error(
        "Navigation configuration must contain site and sections."
      );
    }

    const sectionIds = new Set();
    const sectionPaths = new Set();
    const chapterIds = new Set();

    data.sections.forEach((section) => {
      if (!section.id || !section.label || !section.path) {
        throw new Error(
          "A module is missing its id, label, or path."
        );
      }

      if (sectionIds.has(section.id)) {
        throw new Error(`Duplicate module id: ${section.id}`);
      }

      const normalizedSectionPath = normalizePath(section.path);

      if (sectionPaths.has(normalizedSectionPath)) {
        throw new Error(
          `Duplicate module path: ${normalizedSectionPath}`
        );
      }

      sectionIds.add(section.id);
      sectionPaths.add(normalizedSectionPath);

      if (!Array.isArray(section.chapters)) {
        throw new Error(
          `Module "${section.label}" has no chapters array.`
        );
      }

      if (section.chapters.length > 15) {
        console.warn(
          `Module "${section.label}" contains more than 15 chapters.`
        );
      }

      section.chapters.forEach((chapter) => {
        if (!chapter.id || !chapter.label || !chapter.path) {
          throw new Error(
            `A chapter in "${section.label}" is missing required fields.`
          );
        }

        if (chapterIds.has(chapter.id)) {
          throw new Error(
            `Duplicate chapter id: ${chapter.id}`
          );
        }

        chapterIds.add(chapter.id);
      });
    });

    return data;
  }

  // ---------------------------------------------------------
  // 1. Primary header and module navigation
  // ---------------------------------------------------------

  function renderHeader() {
    const header = document.querySelector("[data-site-header]");

    if (!header) return;

    header.replaceChildren();

    const wrapper = createElement("div", "site-header-inner");

    const brand = createElement("a", "site-brand");
    brand.href = resolveSitePath("index.html");

    const mark = createElement(
      "span",
      "site-brand-mark",
      config.site.shortName || "GS-I"
    );

    const brandText = createElement(
      "span",
      "site-brand-text",
      config.site.name || "UPSC GS-I"
    );

    brand.append(mark, brandText);

    const nav = createElement("nav", "primary-navigation");

    nav.setAttribute("aria-label", "Primary navigation");

    const homeLink = createLink(
      "Home",
      "index.html",
      "primary-nav-link"
    );

    nav.appendChild(homeLink);

    const modules = createElement("div", "module-dropdown");

    const dropdownButton = createElement(
      "button",
      "module-dropdown-toggle",
      config.interface?.moduleMenuLabel || "Modules"
    );

    dropdownButton.type = "button";
    dropdownButton.setAttribute("aria-expanded", "false");

    const dropdownList = createElement(
      "div",
      "module-dropdown-list"
    );

    dropdownList.hidden = true;

    config.sections.forEach((section) => {
      const label = section.number
        ? `${section.number}. ${section.label}`
        : section.label;

      const link = createLink(
        label,
        section.path,
        "module-dropdown-link"
      );

      const count = createElement(
        "span",
        "module-dropdown-count",
        section.chapters.length
      );

      link.appendChild(count);
      dropdownList.appendChild(link);
    });

    dropdownButton.addEventListener("click", () => {
      const expanded =
        dropdownButton.getAttribute("aria-expanded") === "true";

      dropdownButton.setAttribute(
        "aria-expanded",
        String(!expanded)
      );

      dropdownList.hidden = expanded;
    });

    modules.append(dropdownButton, dropdownList);
    nav.appendChild(modules);

    wrapper.append(brand, nav);

    if (config.interface?.search !== false) {
      const search = createSearch();

      if (search) wrapper.appendChild(search);
    }

    header.appendChild(wrapper);
  }

  // ---------------------------------------------------------
  // 2. Search
  // ---------------------------------------------------------

  function createSearch() {
    const wrapper = createElement("div", "site-search");

    const input = createElement("input", "site-search-input");

    input.type = "search";
    input.placeholder = "Search modules and chapters";

    input.setAttribute(
      "aria-label",
      "Search modules and chapters"
    );

    const results = createElement(
      "div",
      "site-search-results"
    );

    results.hidden = true;

    const searchableItems = [];

    config.sections.forEach((section) => {
      searchableItems.push({
        label: section.label,
        path: section.path,
        type: "Module"
      });

      section.chapters.forEach((chapter) => {
        searchableItems.push({
          label: chapter.label,
          path: chapter.path,
          type: section.label
        });
      });
    });

    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();

      results.replaceChildren();

      if (!query) {
        results.hidden = true;
        return;
      }

      const matches = searchableItems
        .filter((item) =>
          item.label.toLowerCase().includes(query)
        )
        .slice(0, 12);

      if (!matches.length) {
        results.appendChild(
          createElement(
            "div",
            "search-no-results",
            "No results found"
          )
        );
      } else {
        matches.forEach((item) => {
          const link = createLink(
            item.label,
            item.path,
            "search-result-link"
          );

          const type = createElement(
            "span",
            "search-result-type",
            item.type
          );

          link.appendChild(type);
          results.appendChild(link);
        });
      }

      results.hidden = false;
    });

    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) {
        results.hidden = true;
      }
    });

    wrapper.append(input, results);

    return wrapper;
  }

  // ---------------------------------------------------------
  // 3. Home page introduction and module directory
  // ---------------------------------------------------------

  function renderHomeIntro() {
    const intro = document.querySelector("[data-home-intro]");

    if (!intro) return;

    const text =
      config.site.homeIntro ||
      config.site.description ||
      "";

    intro.textContent = text;
  }

  function renderHomeDirectory() {
    const container = document.querySelector(
      "[data-module-directory]"
    );

    if (!container) return;

    container.replaceChildren();

    const table = createElement(
      "table",
      "module-directory-table"
    );

    const thead = createElement("thead");
    const tbody = createElement("tbody");
    const headerRow = createElement("tr");

    const headings = [
      "Module No.",
      "Module Name",
      "Description / Coverage",
      "No. of Chapters"
    ];

    headings.forEach((heading) => {
      const th = createElement("th", "", heading);

      th.scope = "col";
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);

    config.sections.forEach((section, index) => {
      const row = createElement("tr");

      const numberCell = createElement(
        "td",
        "module-table-number",
        section.number || index + 1
      );

      const nameCell = createElement("td");

      const nameLink = createLink(
        section.label,
        section.path,
        "module-table-link"
      );

      nameCell.appendChild(nameLink);

      const descriptionCell = createElement(
        "td",
        "module-table-description",
        section.description || ""
      );

      const countCell = createElement(
        "td",
        "module-table-count",
        section.chapters.length
      );

      row.append(
        numberCell,
        nameCell,
        descriptionCell,
        countCell
      );

      tbody.appendChild(row);
    });

    table.append(thead, tbody);
    container.appendChild(table);
  }

  // ---------------------------------------------------------
  // 4. Module landing page content
  // ---------------------------------------------------------

  function renderModulePage() {
    const section = pageContext.section;

    if (!section) return;

    setText("[data-page-title]", section.label);
    setText("[data-module-title]", section.label);
    setText(
      "[data-module-description]",
      section.description || ""
    );
    setText(
      "[data-module-explanation]",
      section.explanation || ""
    );

    const description = document.querySelector(
      "[data-module-description]"
    );

    if (description) {
      description.classList.add("module-subtitle");
    }

    const explanation = document.querySelector(
      "[data-module-explanation]"
    );

    if (explanation) {
      explanation.classList.add("module-explanation");
    }

    const guidance = document.querySelector(
      "[data-study-guidance-list]"
    );

    if (guidance) {
      guidance.replaceChildren();

      (section.studyGuidance || []).forEach((item) => {
        guidance.appendChild(
          createElement("li", "", item)
        );
      });
    }

    setText(
      "[data-exam-relevance-text]",
      section.examRelevance || ""
    );

    const chapterList = document.querySelector(
      "[data-chapter-list]"
    );

    if (chapterList) {
      chapterList.replaceChildren();

      (section.chapters || []).forEach((chapter) => {
        const item = createElement(
          "li",
          "chapter-directory-item"
        );

        const link = createLink(
          chapter.label,
          chapter.path,
          "chapter-directory-link"
        );

        item.appendChild(link);

        if (chapter.status) {
          const statusLabel =
            chapter.status === "ready"
              ? "Available"
              : chapter.status === "planned"
                ? "Planned"
                : chapter.status;

          item.appendChild(
            createElement(
              "span",
              `chapter-status status-${chapter.status}`,
              statusLabel
            )
          );
        }

        chapterList.appendChild(item);
      });
    }
  }

  // ---------------------------------------------------------
  // 5. Secondary chapter sidebar
  // ---------------------------------------------------------

  function renderSidebar() {
    const interfaceConfig = config.interface || {};

    if (
      !pageContext.section ||
      interfaceConfig.secondaryNavigation !== "module-chapters"
    ) {
      return;
    }

    const sidebar = getOrCreate(
      "[data-secondary-navigation]",
      document.body,
      "aside",
      "secondary-navigation"
    );

    sidebar.replaceChildren();

    sidebar.classList.add("secondary-navigation");

    sidebar.setAttribute(
      "aria-label",
      "Module chapters"
    );

    const heading = createElement(
      "h2",
      "sidebar-heading",
      pageContext.section.label
    );

    const chapterList = createElement(
      "ol",
      "chapter-navigation-list"
    );

    (pageContext.section.chapters || []).forEach((chapter) => {
      const item = createElement(
        "li",
        "chapter-navigation-item"
      );

      const link = createLink(
        chapter.label,
        chapter.path,
        "chapter-navigation-link"
      );

      if (
        pageContext.chapter &&
        pageContext.chapter.id === chapter.id
      ) {
        item.classList.add("is-active");

        link.setAttribute("aria-current", "page");
      }

      item.appendChild(link);
      chapterList.appendChild(item);
    });

    sidebar.append(heading, chapterList);
  }

  // ---------------------------------------------------------
  // 6. Breadcrumbs
  // ---------------------------------------------------------

  function renderBreadcrumbs() {
    if (config.interface?.showBreadcrumbs === false) {
      return;
    }

    const container = document.querySelector(
      "[data-breadcrumbs]"
    );

    if (!container) return;

    container.replaceChildren();

    container.classList.add("breadcrumbs");

    const list = createElement("ol", "breadcrumb-list");

    const homeItem = createElement(
      "li",
      "breadcrumb-item"
    );

    homeItem.appendChild(
      createLink("Home", "index.html")
    );

    list.appendChild(homeItem);

    if (pageContext.section) {
      const moduleItem = createElement(
        "li",
        "breadcrumb-item"
      );

      moduleItem.appendChild(
        createLink(
          pageContext.section.label,
          pageContext.section.path
        )
      );

      list.appendChild(moduleItem);
    }

    if (pageContext.chapter) {
      const chapterItem = createElement(
        "li",
        "breadcrumb-item breadcrumb-current"
      );

      chapterItem.textContent = pageContext.chapter.label;

      chapterItem.setAttribute("aria-current", "page");

      list.appendChild(chapterItem);
    }

    container.appendChild(list);
  }

  // ---------------------------------------------------------
  // 7. Previous and next chapter navigation
  // ---------------------------------------------------------

  function renderPreviousNext() {
    if (
      pageContext.type !== "chapter" ||
      !pageContext.section
    ) {
      return;
    }

    const section = pageContext.section;
    const index = pageContext.chapterIndex;

    const container = document.querySelector(
      "[data-chapter-pagination]"
    );

    if (!container) return;

    container.replaceChildren();

    if (index > 0) {
      const previous = section.chapters[index - 1];

      container.appendChild(
        createLink(
          `← Previous: ${previous.label}`,
          previous.path,
          "chapter-previous"
        )
      );
    } else {
      container.appendChild(
        createElement(
          "span",
          "chapter-previous disabled"
        )
      );
    }

    if (index < section.chapters.length - 1) {
      const next = section.chapters[index + 1];

      container.appendChild(
        createLink(
          `Next: ${next.label} →`,
          next.path,
          "chapter-next"
        )
      );
    } else {
      container.appendChild(
        createElement(
          "span",
          "chapter-next disabled"
        )
      );
    }
  }

  // ---------------------------------------------------------
  // 8. Footer
  // ---------------------------------------------------------

  function renderFooter() {
    const footer = document.querySelector(
      "[data-site-footer]"
    );

    if (!footer) return;

    footer.replaceChildren();

    const wrapper = createElement(
      "div",
      "site-footer-inner"
    );

    const copyright = createElement(
      "p",
      "footer-copyright",
      config.site.footerText ||
        "UPSC GS-I Knowledge System"
    );

    const home = createLink(
      "Home",
      "index.html",
      "footer-home-link"
    );

    wrapper.append(copyright, home);

    footer.appendChild(wrapper);
  }

  // ---------------------------------------------------------
  // 9. Page title and document title
  // ---------------------------------------------------------

  function renderPageTitle() {
    const title = document.querySelector("[data-page-title]");

    if (pageContext.type === "home") {
      const homeTitle =
        config.site.homeTitle ||
        config.site.name ||
        "UPSC GS-I";

      document.title = homeTitle;

      if (title) title.textContent = homeTitle;

      return;
    }

    if (pageContext.type === "module") {
      const moduleTitle = pageContext.section.label;

      document.title =
        `${moduleTitle} | ${config.site.name || "UPSC GS-I"}`;

      if (title) title.textContent = moduleTitle;

      return;
    }

    if (pageContext.type === "chapter") {
      const chapterTitle = pageContext.chapter.label;

      document.title =
        `${chapterTitle} | ${config.site.name || "UPSC GS-I"}`;

      if (title) title.textContent = chapterTitle;

      return;
    }

    document.title = config.site.name || "UPSC GS-I";
  }

  // ---------------------------------------------------------
  // 10. Initialise shared site elements
  // ---------------------------------------------------------

  function initialize() {
    renderHeader();
    renderHomeIntro();
    renderBreadcrumbs();
    renderSidebar();
    renderPreviousNext();
    renderFooter();
    renderPageTitle();

    if (pageContext.type === "home") {
      renderHomeDirectory();
    }

    if (pageContext.type === "module") {
      renderModulePage();
    }

    document.documentElement.setAttribute(
      "data-navigation-ready",
      "true"
    );

    console.info(
      `GS-I navigation loaded: ${config.sections.length} modules, ` +
      `${config.sections.reduce(
        (total, section) =>
          total + section.chapters.length,
        0
      )} chapters.`
    );
  }

  // ---------------------------------------------------------
  // 11. Load configuration and start
  // ---------------------------------------------------------

  async function start() {
    try {
      const response = await fetch(CONFIG_URL.href, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load navigation configuration: HTTP ${response.status}`
        );
      }

      const data = await response.json();

      config = validateConfig(data);
      pageContext = getPageContext();

      initialize();
    } catch (error) {
      console.error("GS-I navigation error:", error);

      document.documentElement.setAttribute(
        "data-navigation-error",
        "true"
      );

      const errorContainer = document.querySelector(
        "[data-navigation-error-message]"
      );

      if (errorContainer) {
        errorContainer.textContent =
          "Navigation could not be loaded. Please check the navigation configuration and try again.";
      }
    }
  }

  start();
})();
