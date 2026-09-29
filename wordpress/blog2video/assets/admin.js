window.Blog2VideoInitAdmin = function () {
  "use strict";
  var panel = document.getElementById("b2v-panel");
  if (!panel || !window.wp || !wp.apiFetch) return false;
  if (panel.dataset.b2vInitialized === "true") return true;
  var postId = Number(Blog2VideoAdmin.postId);
  var base = Blog2VideoAdmin.root + postId;
  var APP_URL = String(Blog2VideoAdmin.appUrl || "https://blog2video.app").replace(/\/$/, "");
  var BILLING_URL = APP_URL + "/signin?redirect=" + encodeURIComponent("/subscription");
  var status = document.getElementById("b2v-status");
  var statusCard = document.getElementById("b2v-status-card");
  var progress = document.getElementById("b2v-progress");
  var generate = document.getElementById("b2v-generate");
  if (!generate) return false;
  var generateLabel = document.getElementById("b2v-generate-label");
  var settingsGrid = document.getElementById("b2v-settings-grid");
  var generateWarning = document.getElementById("b2v-generate-warning");
  var generateActions = document.getElementById("b2v-generate-actions");
  var sourceSection = document.getElementById("b2v-source-section");
  var voiceSection = document.getElementById("b2v-voice-section");
  var renderActions = document.getElementById("b2v-render-actions");
  var render = document.getElementById("b2v-render");
  var embed = document.getElementById("b2v-embed");
  var downloadVideo = document.getElementById("b2v-download-video");
  function setEmbedReady(ready) {
    if (embed) embed.disabled = !ready;
  }
  function updateEmbedLabel() {
    if (!embed) return;
    embed.textContent = hasExistingVideo() ? "Remove video" : "Add video to post";
  }
  var activeProjectName = document.getElementById("b2v-active-project-name");
  var activeProjectId = document.getElementById("b2v-active-project-id");
  var browseProjects = document.getElementById("b2v-browse-projects");
  var projectModal = document.getElementById("b2v-project-modal");
  var projectSearch = document.getElementById("b2v-project-search");
  var projectGrid = document.getElementById("b2v-project-grid");
  var projectEmpty = document.getElementById("b2v-project-empty");
  var sourceType = document.getElementById("b2v-source-type");
  var sourceUrl = document.getElementById("b2v-source-url");
  var sourceUrlWrap = document.getElementById("b2v-source-url-wrap");
  var postSourceHelp = document.getElementById("b2v-post-source-help");
  var templateSelect = document.getElementById("b2v-template");
  var selectedTemplate = document.getElementById("b2v-selected-template");
  var modalSelectedTemplate = document.getElementById("b2v-modal-selected-template");
  var modalTemplateSelect = document.getElementById("b2v-modal-template-select");
  var modalBrowseTemplates = document.getElementById("b2v-modal-browse-templates");
  var modalSelectedVoice = document.getElementById("b2v-modal-selected-voice");
  var modalBrowseVoices = document.getElementById("b2v-modal-browse-voices");
  var voiceGender = document.getElementById("b2v-voice-gender");
  var voiceAccent = document.getElementById("b2v-voice-accent");
  var customVoiceId = document.getElementById("b2v-custom-voice-id");
  var selectedVoice = document.getElementById("b2v-selected-voice");
  var browseTemplates = document.getElementById("b2v-browse-templates");
  var browseVoices = document.getElementById("b2v-browse-voices");
  var libraryModal = document.getElementById("b2v-library-modal");
  var libraryTitle = document.getElementById("b2v-library-title");
  var librarySearch = document.getElementById("b2v-library-search");
  var libraryGrid = document.getElementById("b2v-library-grid");
  var libraryEmpty = document.getElementById("b2v-library-empty");
  var refineCard = document.getElementById("b2v-refine-card");
  var editorLink = document.getElementById("b2v-editor");
  var projectSettingsCard = document.getElementById("b2v-project-settings-card");
  var projectSettingsModal = document.getElementById("b2v-project-settings-modal");
  var openProjectSettings = document.getElementById("b2v-open-project-settings");
  var logoPreview = document.getElementById("b2v-logo-preview");
  var logoPreviewImage = document.getElementById("b2v-logo-preview-image");
  var logoEmpty = document.getElementById("b2v-logo-empty");
  var logoChoose = document.getElementById("b2v-logo-choose");
  var logoInput = document.getElementById("b2v-logo-input");
  var logoRemove = document.getElementById("b2v-logo-remove");
  var logoSettings = document.getElementById("b2v-logo-settings");
  var logoPosition = document.getElementById("b2v-logo-position");
  var logoSize = document.getElementById("b2v-logo-size");
  var logoOpacity = document.getElementById("b2v-logo-opacity");
  var logoMessage = document.getElementById("b2v-logo-message");
  var logoLoaded = false;
  var wizardLogoChoose = document.getElementById("b2v-wizard-logo-choose");
  var wizardLogoInput = document.getElementById("b2v-wizard-logo-input");
  var wizardLogoPreview = document.getElementById("b2v-wizard-logo-preview");
  var wizardLogoFilename = document.getElementById("b2v-wizard-logo-filename");
  var wizardLogoRemove = document.getElementById("b2v-wizard-logo-remove");
  var wizardLogoMessage = document.getElementById("b2v-wizard-logo-message");
  var wizardLogoSettings = document.getElementById("b2v-wizard-logo-settings");
  var wizardLogoPosition = document.getElementById("b2v-wizard-logo-position");
  var wizardLogoOpacity = document.getElementById("b2v-wizard-logo-opacity");
  var stagedLogoFile = null;
  var wizardTemplateGrid = document.getElementById("b2v-wizard-template-grid");
  var wizardTemplateLoading = document.getElementById("b2v-wizard-template-loading");
  var wizardTemplateEmpty = document.getElementById("b2v-wizard-template-empty");
  var wizardTemplatePreview = document.getElementById("b2v-wizard-template-preview");
  var wizardColors = document.getElementById("b2v-wizard-colors");
  var wizardColorsLoading = document.getElementById("b2v-wizard-colors-loading");
  var wizardColorAccent = document.getElementById("b2v-wizard-color-accent");
  var wizardColorBg = document.getElementById("b2v-wizard-color-bg");
  var wizardColorText = document.getElementById("b2v-wizard-color-text");
  var wizardVideoStyle = document.getElementById("b2v-video-style");
  var wizardStyleGrid = document.getElementById("b2v-wizard-style-grid");
  var wizardStyleLoading = document.getElementById("b2v-wizard-style-loading");
  var wizardStyleEmpty = document.getElementById("b2v-wizard-style-empty");
  var wizardVoiceList = document.getElementById("b2v-wizard-voice-list");
  var wizardVoiceLoading = document.getElementById("b2v-wizard-voice-loading");
  var wizardVoiceEmpty = document.getElementById("b2v-wizard-voice-empty");
  var noVoiceover = document.getElementById("b2v-no-voiceover");
  var wizardMusicTrack = document.getElementById("b2v-wizard-music-track");
  var colorAccent = document.getElementById("b2v-color-accent");
  var colorBg = document.getElementById("b2v-color-bg");
  var colorText = document.getElementById("b2v-color-text");
  var fontFamily = document.getElementById("b2v-font-family");
  var styleLoading = document.getElementById("b2v-style-loading");
  var styleFields = document.getElementById("b2v-style-fields");
  var colorsSave = document.getElementById("b2v-colors-save");
  var colorsMessage = document.getElementById("b2v-colors-message");
  var captionsToggle = document.getElementById("b2v-captions-toggle");
  var captionFont = document.getElementById("b2v-caption-font");
  var captionSize = document.getElementById("b2v-caption-size");
  var captionOffset = document.getElementById("b2v-caption-offset");
  var captionsSave = document.getElementById("b2v-captions-save");
  var captionsMessage = document.getElementById("b2v-captions-message");
  var musicTrack = document.getElementById("b2v-music-track");
  var musicPlay = document.getElementById("b2v-music-play");
  var musicVolume = document.getElementById("b2v-music-volume");
  var musicSave = document.getElementById("b2v-music-save");
  var musicMessage = document.getElementById("b2v-music-message");
  var confirmModal = document.getElementById("b2v-confirm-modal");
  var confirmTitle = document.getElementById("b2v-confirm-title");
  var confirmMessage = document.getElementById("b2v-confirm-message");
  var confirmCancel = document.getElementById("b2v-confirm-cancel");
  var confirmProceed = document.getElementById("b2v-confirm-proceed");
  var operationToast = document.getElementById("b2v-operation-toast");
  var operationTitle = document.getElementById("b2v-operation-title");
  var operationMessage = document.getElementById("b2v-operation-message");
  var musicTracksLoaded = false;
  var wizardMusicTracksLoaded = false;
  var musicAudio;
  var settingsLoaded = false;
  var timer;
  var embedded = Boolean(Blog2VideoAdmin.hasEmbed);
  var catalogPromise;
  var videoStylesPromise;
  var accountPromise;
  var accountDetails = null;
  var aiCreditsAvailable = null;
  var VOICEOVER_EDIT_CREDIT_COST = 5;
  var libraryMode = "templates";
  var libraryTemplateChangeIsLive = false;
  var libraryVoiceChangeIsLive = false;
  var templateChangeTimer;
  var voiceChangeTimer;
  var activeAudio;
  var libraryAllItems = [];
  var availableProjects = [];
  var projectLibraryPage = 1;
  var projectLibraryHasMore = false;
  var projectLibraryLoading = false;
  var confirmResolve = null;
  var operationHideTimer = null;
  var quotaPromptPending = false;

  function savePostBeforeGeneration() {
    if (!window.wp || !wp.data || typeof wp.data.dispatch !== "function") return Promise.resolve();
    var editorStore = wp.data.dispatch("core/editor");
    if (!editorStore || typeof editorStore.savePost !== "function") return Promise.resolve();
    message("Saving the latest post changes…", false, true);
    showOperation("Preparing your video", "Saving the latest post content…");
    if (generateLabel) generateLabel.textContent = "Saving post…";
    return Promise.resolve(editorStore.savePost()).then(function () {
      var editorSelect = typeof wp.data.select === "function" ? wp.data.select("core/editor") : null;
      var saveError = editorSelect && typeof editorSelect.getLastEntitySaveError === "function"
        ? editorSelect.getLastEntitySaveError()
        : null;
      if (saveError) throw new Error(saveError.message || "WordPress could not save this post.");
    });
  }

  function handleGenerateClick(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (generate.disabled) return;
    if (accountDetails && accountDetails.can_create_video === false) {
      showQuotaReached(accountDetails);
      return;
    }
    if (!postId) {
      message("Save this post once before generating a video.", true);
      showOperation("Could not start generation", "Save this post once, then try again.", "error");
      return;
    }
    if (sourceType && sourceType.value === "url" && (!sourceUrl.value || !sourceUrl.checkValidity())) {
      sourceUrl.reportValidity();
      message("Enter a valid source URL.", true);
      showOperation("Could not start generation", "Enter a valid source URL.", "error");
      return;
    }
    setButtonBusy(generate, true);
    generate.setAttribute("aria-busy", "true");
    setEmbedReady(false);
    toggleUpgradeSlot(null);
    savePostBeforeGeneration().then(function () {
      message(sourceType && sourceType.value === "url" ? "Reading the supplied article…" : "Reading the current post…", false, true);
      if (generateLabel) generateLabel.textContent = "Starting video…";
      showOperation("Creating your video", sourceType && sourceType.value === "url" ? "Reading the supplied article…" : "Reading the saved post content…");
      return wp.apiFetch({ path: base + "/generate", method: "POST", data: values() });
    }).then(function (data) {
      if (Number(data.project_id) !== Number(Blog2VideoAdmin.projectId)) embedded = false;
      markProjectAvailable(data.project_id, data.project_name);
      uploadStagedLogo(base);
      message("Creating your video…", false, true);
      if (generateLabel) generateLabel.textContent = "Generating video…";
      showOperation("Video generation started", "Your scenes are being created. You can keep this editor open.");
      pollGeneration();
    }).catch(function (error) {
      setButtonBusy(generate, false);
      generate.removeAttribute("aria-busy");
      if (generateLabel) generateLabel.textContent = "Generate video";
      var detail = errorText(error);
      showUpgradePrompt(error);
      showOperation("Could not start generation", detail, "error");
    });
  }

  // React calls this directly, so the first click never depends on a listener
  // being attached after the button has already appeared.
  window.Blog2VideoGenerate = handleGenerateClick;

  // Gutenberg places meta boxes inside containers that establish their own
  // positioning/overflow context. Keeping a fixed modal inside that tree clips it
  // to the editor canvas and underneath the Post sidebar. Portal both dialogs to
  // <body> so they consistently cover the real browser viewport.
  document.body.appendChild(libraryModal);
  document.body.appendChild(projectModal);
  document.body.appendChild(projectSettingsModal);
  document.body.appendChild(confirmModal);
  document.body.appendChild(operationToast);

  function updateSourceFields() {
    var fromUrl = sourceType && sourceType.value === "url";
    if (sourceUrlWrap) sourceUrlWrap.hidden = !fromUrl;
    if (postSourceHelp) postSourceHelp.hidden = fromUrl;
    if (sourceUrl) sourceUrl.required = fromUrl;
  }

  function message(text, error, busy) {
    status.textContent = text || "";
    statusCard.hidden = !text;
    statusCard.classList.toggle("is-error", Boolean(error));
    statusCard.classList.toggle("is-busy", Boolean(busy));
  }

  function settleConfirmation(accepted) {
    if (!confirmModal || confirmModal.hidden) return;
    confirmModal.hidden = true;
    var resolve = confirmResolve;
    confirmResolve = null;
    if (resolve) resolve(Boolean(accepted));
  }

  function confirmAction(title, description, proceedLabel) {
    if (!confirmModal) return Promise.resolve(window.confirm(description));
    if (confirmResolve) settleConfirmation(false);
    if (confirmTitle) confirmTitle.textContent = title || "Confirm action";
    if (confirmMessage) confirmMessage.textContent = description || "Do you want to continue?";
    if (confirmProceed) confirmProceed.textContent = proceedLabel || "Proceed";
    confirmModal.hidden = false;
    return new Promise(function (resolve) {
      confirmResolve = resolve;
      setTimeout(function () { if (confirmCancel) confirmCancel.focus(); }, 0);
    });
  }

  if (confirmCancel) confirmCancel.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    settleConfirmation(false);
  }, true);
  if (confirmProceed) confirmProceed.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    settleConfirmation(true);
  }, true);

  function showOperation(title, detail, state) {
    if (!operationToast) return;
    clearTimeout(operationHideTimer);
    operationToast.classList.toggle("is-error", state === "error");
    operationToast.classList.toggle("is-complete", state === "complete");
    if (operationTitle) operationTitle.textContent = title || "Updating video";
    if (operationMessage) operationMessage.textContent = detail || "Your changes are being applied…";
    operationToast.hidden = false;
    if (state === "complete") operationHideTimer = setTimeout(function () { operationToast.hidden = true; }, 5000);
  }

  function refreshEmbeddedPreviews() {
    var refreshIn = function (root) {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll('iframe[title="Blog2Video preview"], iframe[title="Blog2Video player"]').forEach(function (frame) {
        try {
          var url = new URL(frame.src, window.location.href);
          url.searchParams.set("blog2video_refresh", String(Date.now()));
          frame.src = url.toString();
        } catch (error) {}
      });
    };
    refreshIn(document);
    document.querySelectorAll("iframe").forEach(function (frame) {
      try { refreshIn(frame.contentDocument); } catch (error) {}
    });
  }
  function setProgress(value) {
	if (value === null || value === undefined || value === "") {
	  progress.hidden = true;
	  return;
	}
    var numeric = Number(value);
    progress.hidden = !Number.isFinite(numeric);
    if (!progress.hidden) progress.querySelector("span").style.width = Math.max(0, Math.min(100, numeric)) + "%";
  }
  function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle("is-loading", busy);
  }
  function lockSettingsGrid() {
    if (!settingsGrid) return;
    settingsGrid.classList.add("is-locked");
    settingsGrid.querySelectorAll("select, input[type='checkbox'], .b2v-choice-button").forEach(function (field) {
      field.disabled = true;
    });
  }

  function markProjectAvailable(projectId, projectName) {
    if (projectId) Blog2VideoAdmin.projectId = Number(projectId);
    if (projectName) Blog2VideoAdmin.projectName = projectName;
    Blog2VideoAdmin.hasProject = Number(Blog2VideoAdmin.projectId) > 0;
    if (window.Blog2VideoSetActiveProject && Blog2VideoAdmin.hasProject) {
      window.Blog2VideoSetActiveProject(Number(Blog2VideoAdmin.projectId), Blog2VideoAdmin.projectName || "Selected Blog2Video project");
    }
    if (activeProjectName) activeProjectName.textContent = Blog2VideoAdmin.projectName || "Selected Blog2Video project";
    if (activeProjectId) activeProjectId.textContent = Number(Blog2VideoAdmin.projectId) ? "Project #" + Number(Blog2VideoAdmin.projectId) : "Choose an existing video or create a new one below.";
    if (editorLink && Number(Blog2VideoAdmin.projectId)) editorLink.href = APP_URL + "/project/" + Number(Blog2VideoAdmin.projectId);
    if (refineCard && Number(Blog2VideoAdmin.projectId)) refineCard.hidden = false;
    if (projectSettingsCard && Number(Blog2VideoAdmin.projectId)) projectSettingsCard.hidden = false;
    if (Number(Blog2VideoAdmin.projectId)) {
      if (renderActions) renderActions.hidden = false;
      lockSettingsGrid();
      if (sourceSection) sourceSection.hidden = true;
      if (voiceSection) voiceSection.hidden = true;
      if (generateWarning) generateWarning.hidden = true;
      if (generateActions) generateActions.hidden = true;
    }
  }

  function applyInitialProjectState() {
    var hasProject = Number(Blog2VideoAdmin.projectId) > 0;
    if (hasProject) {
      markProjectAvailable(Blog2VideoAdmin.projectId, Blog2VideoAdmin.projectName);
      return;
    }

    Blog2VideoAdmin.projectId = 0;
    Blog2VideoAdmin.projectName = "";
    if (activeProjectName) activeProjectName.textContent = "No project selected";
    if (activeProjectId) activeProjectId.textContent = "Choose an existing video or create a new one below.";
    if (generateWarning) generateWarning.hidden = false;
    if (generate) generate.hidden = false;
    if (render) render.hidden = true;
    if (refineCard) refineCard.hidden = true;
    if (projectSettingsCard) projectSettingsCard.hidden = true;
    if (renderActions) renderActions.hidden = true;
    setEmbedReady(false);
  }

  function showEmbedPrompt() {
    clearTimeout(timer);
    setProgress(null);
    render.hidden = true;
    setButtonBusy(render, false);
    setEmbedReady(true);
    refreshEmbeddedPreviews();
    if (embedded) {
      message("Video is ready and already linked to this post.");
      return;
    }
    message("Rendering complete. Your video is ready.");
  }
  function errorText(error) {
    return (error && (error.message || error.code)) || "Blog2Video request failed.";
  }

  function isLimitError(error) {
    return Boolean(error && error.code === "blog2video_video_limit");
  }

  function isUpgradeError(error) {
    return Boolean(error && ["blog2video_video_limit", "blog2video_upgrade_required"].includes(error.code));
  }

  function toggleUpgradeSlot(error) {
    var slot = document.getElementById("b2v-upgrade-slot");
    var link = document.getElementById("b2v-upgrade-link");
    if (!slot || !link) return;
    if (!isUpgradeError(error)) {
      slot.hidden = true;
      return;
    }
    link.href = BILLING_URL;
    slot.hidden = false;
  }

  function showQuotaModal(detail) {
    if (quotaPromptPending) return;
    quotaPromptPending = true;
    confirmAction(
      "Video limit reached",
      detail || "You have used all videos included with your current plan. Upgrade your plan or buy more video credits to continue.",
      "Upgrade plan"
    ).then(function (accepted) {
      quotaPromptPending = false;
      if (!accepted) return;
      var opened = window.open(BILLING_URL, "_blank");
      if (opened) opened.opener = null;
      else window.location.assign(BILLING_URL);
    });
  }

  function showUpgradePrompt(error) {
    message(errorText(error), true);
    toggleUpgradeSlot(error);
    if (isLimitError(error) && !Number(Blog2VideoAdmin.projectId)) {
      accountDetails = Object.assign({}, accountDetails || {}, { can_create_video: false });
      generate.disabled = false;
      generate.setAttribute("aria-disabled", "true");
      if (generateLabel) generateLabel.textContent = "Video limit reached";
      showQuotaModal(errorText(error));
    }
  }

  function showQuotaReached(account, openModal) {
    var used = Number(account && account.videos_used || 0);
    var limit = Number(account && account.video_limit || 0);
    var detail = "Video limit reached (" + used + " of " + limit + " used). Upgrade your plan or buy more video credits to continue.";
    generate.disabled = false;
    generate.setAttribute("aria-disabled", "true");
    if (generateLabel) generateLabel.textContent = "Video limit reached";
    message(detail, true);
    toggleUpgradeSlot({ code: "blog2video_video_limit" });
    if (openModal !== false) showQuotaModal(detail);
  }

  function applyAccountQuota(account) {
    accountDetails = account || null;
    if (!accountDetails || Number(Blog2VideoAdmin.projectId)) return;
    if (accountDetails.can_create_video === false) {
      // Mark the action clearly, but wait until the user clicks it before
      // opening a blocking modal. This avoids an unsolicited popup whenever
      // the editor/sidebar loads.
      showQuotaReached(accountDetails, false);
      return;
    }
    if (!generate.hasAttribute("aria-busy")) {
      generate.disabled = false;
      generate.removeAttribute("aria-disabled");
      if (generateLabel && generateLabel.textContent === "Video limit reached") generateLabel.textContent = "Generate video";
    }
  }

  function closeProjectLibrary() {
    projectModal.hidden = true;
    document.body.classList.remove("b2v-project-open");
  }

  function projectMatches(project) {
    var query = projectSearch.value.trim().toLowerCase();
    return !query || [project.name, project.id, project.status, project.owner_name].join(" ").toLowerCase().includes(query);
  }

  function projectStatusLabel(status) {
    var normalized = String(status || "created").toLowerCase();
    var labels = {
      created: "Created",
      scraped: "Scraped",
      scripted: "Script Ready",
      awaiting_script_review: "Needs script review",
      awaiting_stock_footage_review: "Needs footage review",
      awaiting_footage: "Needs footage review",
      generated: "Generated",
      rendering: "Rendering",
      done: "Complete",
      error: "Error",
      regenerating: "Regenerating",
      script_regenerating: "Regenerating Script",
      voice_regenerating: "Regenerating Voiceover",
      language_regenerating: "Translating the project"
    };
    return labels[normalized] || normalized.replace(/_/g, " ").replace(/^./, function (character) {
      return character.toUpperCase();
    });
  }

  function selectLibraryProject(project, addAfterSelect, triggerButton) {
    setButtonBusy(triggerButton, true);
    wp.apiFetch({ path: base + "/projects/select", method: "POST", data: { project_id: project.id } }).then(function (selected) {
      embedded = false;
      markProjectAvailable(selected.project_id, selected.name);
      availableProjects = availableProjects.map(function (item) {
        return Object.assign({}, item, { active: Number(item.id) === Number(selected.project_id) });
      });
      if (addAfterSelect && selected.has_video) {
        return createEmbed(triggerButton, true);
      }
      closeProjectLibrary();
      render.hidden = Boolean(selected.has_video);
      message("Using “" + selected.name + "” (Project #" + selected.project_id + ").");
      pollGeneration();
    }).catch(function (error) {
      setButtonBusy(triggerButton, false);
      message(errorText(error), true);
    });
  }

  function renderProjectLibrary() {
    projectGrid.textContent = "";
    var visible = availableProjects.filter(projectMatches);
    projectEmpty.hidden = visible.length > 0;
    visible.forEach(function (project) {
      var active = Number(project.id) === Number(Blog2VideoAdmin.projectId);
      var row = document.createElement("article");
      row.className = "b2v-project-row" + (active ? " is-active" : "");
      var top = document.createElement("div");
      top.className = "b2v-project-row-top";
      var copy = document.createElement("div");
      copy.className = "b2v-project-row-copy";
      var badges = document.createElement("div");
      badges.className = "b2v-project-badges";
      copy.innerHTML = '<strong></strong>';
      copy.querySelector("strong").textContent = project.name || "Untitled project";
      badges.innerHTML = '<span class="b2v-project-status"></span>' + (active ? '<span class="is-active">Currently selected</span>' : '');
      badges.querySelector(".b2v-project-status").textContent = projectStatusLabel(project.status);
      copy.appendChild(badges);
      var actions = document.createElement("div");
      actions.className = "b2v-project-row-actions";
      var replace = document.createElement("button");
      replace.type = "button";
      replace.className = "b2v-project-add";
      var postHasVideo = hasExistingVideo();
      replace.textContent = active
        ? (project.has_video && !postHasVideo ? "Add video" : "Open project")
        : (postHasVideo ? "Replace video" : "Add video");
      replace.addEventListener("click", function () {
        if (!active && hasExistingVideo()) {
          confirmAction("Replace the video in this post?", "Using “" + (project.name || "this project") + "” will replace the currently embedded Blog2Video video.", "Replace video").then(function (accepted) {
            if (accepted) selectLibraryProject(project, true, replace);
          });
          return;
        }
        selectLibraryProject(project, true, replace);
      });
      actions.appendChild(replace);
      top.append(copy, actions);
      var meta = document.createElement("div");
      meta.className = "b2v-project-row-meta";
      meta.innerHTML = "<span>Project #" + project.id + "</span><span>" + Number(project.scene_count || 0) + " scenes</span>";
      row.append(top, meta);
      projectGrid.appendChild(row);
    });
    if (projectLibraryHasMore) {
      var loadMore = document.createElement("button");
      loadMore.type = "button";
      loadMore.className = "b2v-project-load-more";
      loadMore.id = "b2v-project-load-more";
      loadMore.innerHTML = '<span>Load more projects</span><span class="b2v-load-more-arrow" aria-hidden="true">↓</span>';
      loadMore.addEventListener("click", function () {
        loadMore.disabled = true;
        loadMore.setAttribute("aria-busy", "true");
        loadMore.innerHTML = '<span class="b2v-load-more-spinner" aria-hidden="true"></span><span>Loading projects…</span>';
        var request = loadProjectLibrary(false, true);
        if (request && typeof request.finally === "function") {
          request.finally(function () {
            if (!loadMore.isConnected) return;
            loadMore.disabled = false;
            loadMore.removeAttribute("aria-busy");
            loadMore.innerHTML = '<span>Load more projects</span><span class="b2v-load-more-arrow" aria-hidden="true">↓</span>';
          });
        }
      });
      projectGrid.appendChild(loadMore);
    }
  }

  function loadProjectLibrary(openWhenReady, appendNextPage) {
    if (projectLibraryLoading) return;
    projectLibraryLoading = true;
    if (!appendNextPage) {
      projectLibraryPage = 1;
      availableProjects = [];
      projectGrid.innerHTML = '<div class="b2v-project-loading"><span></span>Loading your projects…</div>';
      projectEmpty.hidden = true;
    }
    var page = appendNextPage ? projectLibraryPage + 1 : 1;
    return wp.apiFetch({ path: base + "/projects/library?page=" + page + "&per_page=20" }).then(function (result) {
      var items = Array.isArray(result) ? result : (result.items || []);
      var total = Array.isArray(result) ? items.length : Number(result.total || items.length);
      availableProjects = availableProjects.concat(items);
      projectLibraryPage = page;
      projectLibraryHasMore = availableProjects.length < total;
      var current = availableProjects.find(function (project) { return Number(project.id) === Number(Blog2VideoAdmin.projectId); });
      if (current) markProjectAvailable(current.id, current.name);
      renderProjectLibrary();
      if (openWhenReady) projectSearch.focus();
    }).catch(function (error) {
      if (!appendNextPage) {
        projectGrid.textContent = "";
        projectEmpty.hidden = false;
        projectEmpty.textContent = errorText(error);
      } else {
        message(errorText(error), true);
      }
    }).finally(function () { projectLibraryLoading = false; });
  }

  function openProjectLibrary() {
    projectModal.hidden = false;
    document.body.classList.add("b2v-project-open");
    projectSearch.value = "";
    loadProjectLibrary(true, false);
  }
  function values() {
    var data = {};
    panel.querySelectorAll("[data-b2v]").forEach(function (field) {
      data[field.dataset.b2v] = field.type === "checkbox" ? field.checked : field.value;
    });
    return data;
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = wp.apiFetch({ path: base + "/catalog" }).catch(function (error) {
        catalogPromise = null;
        throw error;
      });
    }
    return catalogPromise;
  }

  function loadVideoStyles() {
    if (!videoStylesPromise) {
      videoStylesPromise = wp.apiFetch({ path: base + "/video-styles" }).catch(function (error) {
        videoStylesPromise = null;
        throw error;
      });
    }
    return videoStylesPromise;
  }

  function loadAccount() {
    if (!accountPromise) {
      accountPromise = wp.apiFetch({ path: base + "/account" }).then(function (data) {
        aiCreditsAvailable = Number(data.ai_edit_credits_available || 0);
        applyAccountQuota(data);
        return data;
      }).catch(function (error) {
        accountPromise = null;
        throw error;
      });
    }
    return accountPromise;
  }

  function text(value, fallback) {
    return String(value || fallback || "");
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
  }

  function normalizedSelectValue(select, value, fallback) {
    if (!select) return fallback || "";
    var wanted = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    var match = Array.prototype.find.call(select.options, function (option) {
      return String(option.value || "").trim().toLowerCase().replace(/[\s-]+/g, "_") === wanted;
    });
    return match ? match.value : (fallback || "");
  }

  function closeLibrary() {
    libraryModal.hidden = true;
    libraryModal.classList.remove("is-compact");
    document.body.classList.remove("b2v-library-open");
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
  }

  function chooseTemplate(item) {
    var id = text(item.id, "default");
    var option = Array.prototype.find.call(templateSelect.options, function (entry) { return entry.value === id; });
    if (!option) {
      option = document.createElement("option");
      option.value = id;
      templateSelect.appendChild(option);
    }
    option.textContent = text(item.name, id);
    if (libraryTemplateChangeIsLive && Number(Blog2VideoAdmin.projectId)) {
      closeLibrary();
      requestTemplateChange(id, text(item.name, id));
      return;
    }
    templateSelect.value = id;
    selectedTemplate.textContent = text(item.name, id);
    var previewColors = item.preview_colors || {};
    var templateAccent = safeColor(previewColors.accent, "");
    var templateBg = safeColor(previewColors.bg, "");
    var templateText = safeColor(previewColors.text, "");
    var hasTemplateColors = Boolean(templateAccent && templateBg && templateText);
    [wizardColorAccent, wizardColorBg, wizardColorText].forEach(function (input) {
      if (!input) return;
      if (hasTemplateColors) input.dataset.b2v = input.id === "b2v-wizard-color-accent" ? "accent_color" : input.id === "b2v-wizard-color-bg" ? "bg_color" : "text_color";
      else delete input.dataset.b2v;
    });
    if (hasTemplateColors) {
      wizardColorAccent.value = templateAccent;
      wizardColorBg.value = templateBg;
      wizardColorText.value = templateText;
    }
    if (wizardColorsLoading) {
      wizardColorsLoading.hidden = hasTemplateColors;
      if (!hasTemplateColors) wizardColorsLoading.innerHTML = "Uses this template’s built-in colors.";
    }
    if (wizardColors) wizardColors.hidden = !hasTemplateColors;
    if (wizardTemplatePreview) {
      wizardTemplatePreview.style.backgroundImage = item.preview_url ? "url(\"" + String(item.preview_url).replace(/\"/g, "") + "\")" : "";
      wizardTemplatePreview.classList.toggle("has-image", Boolean(item.preview_url));
    }
    if (wizardTemplateGrid) {
      wizardTemplateGrid.querySelectorAll("[data-template-id]").forEach(function (card) {
        card.classList.toggle("is-selected", card.dataset.templateId === id);
      });
    }
    if (modalSelectedTemplate) modalSelectedTemplate.textContent = text(item.name, id);
    closeLibrary();
  }

  function requestTemplateChange(templateId, templateName) {
    confirmAction(
      "Proceed with video regeneration?",
      "Change the template to “" + templateName + "”? Every scene will be rebuilt and 1 video credit will be used.",
      "Proceed"
    ).then(function (accepted) {
      if (!accepted) return;
      clearTimeout(templateChangeTimer);
      closeLibrary();
      closeProjectSettingsModal();
      message("Changing template…", false, true);
      showOperation("Changing template", "Regenerating scenes with “" + templateName + "”…");
      wp.apiFetch({
        path: base + "/template",
        method: "POST",
        data: { template: templateId },
      }).then(function () {
        pollTemplateChange(templateId, templateName);
      }).catch(function (error) {
        var detail = errorText(error);
        if (/already running/i.test(detail)) {
          showOperation("Video update in progress", "A job is already running for this project.");
          pollTemplateChange(templateId, templateName);
          return;
        }
        message(detail, true);
        showOperation("Template change failed", detail, "error");
        showUpgradePrompt(error);
      });
    });
  }

  function pollTemplateChange(templateId, templateName) {
    clearTimeout(templateChangeTimer);
    wp.apiFetch({ path: base + "/template-status" }).then(function (job) {
      var status = job && job.status;
      if (!job || status === "completed") {
        selectedTemplate.textContent = templateName;
        if (modalSelectedTemplate) modalSelectedTemplate.textContent = templateName;
        templateSelect.value = templateId;
        if (modalTemplateSelect) {
          modalTemplateSelect.value = templateId;
          modalTemplateSelect.dataset.current = templateId;
        }
        message("Template changed to “" + templateName + "”.");
        showOperation("Template updated", "The video preview is ready.", "complete");
        refreshEmbeddedPreviews();
        pollGeneration();
        return;
      }
      if (status === "failed") {
        if (modalTemplateSelect) modalTemplateSelect.value = modalTemplateSelect.dataset.current || "";
        message(job.error_message || "Template change failed. Your video credit was refunded.", true);
        showOperation("Template change failed", job.error_message || "Your video credit was refunded.", "error");
        return;
      }
      message("Changing template…", false, true);
      showOperation("Changing template", job && job.progress != null ? "Regenerating scenes — " + job.progress + "%" : "Regenerating scenes…");
      templateChangeTimer = setTimeout(function () { pollTemplateChange(templateId, templateName); }, 4000);
    }).catch(function (error) { message(errorText(error), true); });
  }

  function chooseVoice(item) {
    var gender = ["female", "male", "none"].includes(String(item.gender).toLowerCase()) ? String(item.gender).toLowerCase() : "female";
    var accentText = String(item.accent || "american").toLowerCase();
    var accent = accentText.includes("brit") || accentText.includes("england") ? "british" : "american";
    var voiceId = item.voice_id || "";
    var voiceLabel = text(item.name, gender === "none" ? "No voice" : gender + " · " + accent);
    if (libraryVoiceChangeIsLive && Number(Blog2VideoAdmin.projectId)) {
      closeLibrary();
      requestVoiceChange(gender, accent, voiceId, voiceLabel);
      return;
    }
    voiceGender.value = gender;
    voiceAccent.value = accent;
    customVoiceId.value = voiceId;
    selectedVoice.textContent = voiceLabel;
    if (noVoiceover) noVoiceover.checked = gender === "none";
    if (wizardVoiceList) {
      wizardVoiceList.classList.toggle("is-disabled", gender === "none");
      wizardVoiceList.querySelectorAll("[data-voice-id]").forEach(function (card) {
        card.classList.toggle("is-selected", card.dataset.voiceId === String(voiceId));
      });
    }
    if (modalSelectedVoice) modalSelectedVoice.textContent = voiceLabel;
    closeLibrary();
  }

  function requestVoiceChange(gender, accent, voiceId, voiceLabel) {
    confirmAction(
      "Proceed with voice regeneration?",
      "Change the voice to “" + voiceLabel + "”? Every scene’s narration will be re-recorded and 1 video credit will be used.",
      "Proceed"
    ).then(function (accepted) {
      if (!accepted) return;
      clearTimeout(voiceChangeTimer);
      closeLibrary();
      closeProjectSettingsModal();
      message("Changing voice…", false, true);
      showOperation("Changing voice", "Re-recording narration with “" + voiceLabel + "”…");
      wp.apiFetch({
        path: base + "/voice",
        method: "POST",
        data: { voice_gender: gender, voice_accent: accent, custom_voice_id: voiceId },
      }).then(function () {
        pollVoiceChange(voiceLabel);
      }).catch(function (error) {
        var detail = errorText(error);
        if (/already running/i.test(detail)) {
          showOperation("Video update in progress", "A job is already running for this project.");
          pollVoiceChange(voiceLabel);
          return;
        }
        message(detail, true);
        showOperation("Voice change failed", detail, "error");
        showUpgradePrompt(error);
      });
    });
  }

  function pollVoiceChange(voiceLabel) {
    clearTimeout(voiceChangeTimer);
    wp.apiFetch({ path: base + "/voice-status" }).then(function (job) {
      if (!job || !job.done) {
        message("Changing voice…" + (job && job.progress != null ? " — " + job.progress + "%" : ""), false, true);
        showOperation("Changing voice", job && job.progress != null ? "Re-recording narration — " + job.progress + "%" : "Re-recording narration…");
        voiceChangeTimer = setTimeout(function () { pollVoiceChange(voiceLabel); }, 4000);
        return;
      }
      if (job.error) {
        message(job.error, true);
        showOperation("Voice change failed", job.error, "error");
        return;
      }
      selectedVoice.textContent = voiceLabel;
      if (modalSelectedVoice) modalSelectedVoice.textContent = voiceLabel;
      message("Voice changed to “" + voiceLabel + "”.");
      showOperation("Voice updated", "The video preview is ready.", "complete");
      refreshEmbeddedPreviews();
      pollGeneration();
    }).catch(function (error) { message(errorText(error), true); });
  }

  function playVoice(event, item) {
    event.stopPropagation();
    var button = event.currentTarget;
    if (!item.preview_url) return;
    if (activeAudio) activeAudio.pause();
    activeAudio = new Audio(item.preview_url);
    button.classList.add("is-playing");
    button.textContent = "■";
    activeAudio.addEventListener("ended", function () {
      button.classList.remove("is-playing");
      button.textContent = "▶";
      activeAudio = null;
    });
    activeAudio.play().catch(function () {
      button.classList.remove("is-playing");
      button.textContent = "▶";
    });
  }

  function templateCard(item) {
    var card = document.createElement("button");
    var colors = item.preview_colors || {};
    var accent = safeColor(colors.accent, "#7c3aed");
    var bg = safeColor(colors.bg, "#111827");
    var foreground = safeColor(colors.text, "#ffffff");
    card.type = "button";
    card.className = "b2v-library-card b2v-template-card" + (templateSelect.value === item.id ? " is-selected" : "");
    card.dataset.search = [item.name, item.id, item.description, (item.genres || []).join(" ")].join(" ").toLowerCase();
    var preview = document.createElement("span");
    preview.className = "b2v-template-preview";
    preview.style.background = bg;
    preview.style.color = foreground;
    var kicker = document.createElement("small");
    kicker.textContent = text((item.genres || [])[0], "Video story");
    var headline = document.createElement("b");
    headline.textContent = text(item.name, item.id);
    var lines = document.createElement("i");
    preview.append(kicker, headline, lines);
    if (item.preview_url) {
      preview.classList.add("has-image");
      var image = document.createElement("img");
      image.className = "b2v-template-preview-image";
      image.src = item.preview_url;
      image.alt = text(item.name, item.id) + " template preview";
      image.loading = "lazy";
      image.addEventListener("error", function () {
        image.remove();
        preview.classList.remove("has-image");
      });
      preview.appendChild(image);
    }
    var check = document.createElement("span");
    check.className = "b2v-template-check";
    check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"></path></svg>';
    preview.appendChild(check);
    var copy = document.createElement("span");
    copy.className = "b2v-card-copy";
    var name = document.createElement("strong");
    name.textContent = text(item.name, item.id);
    var description = document.createElement("span");
    description.textContent = text(item.description, (item.genres || []).join(" · "));
    copy.append(name, description);
    card.append(preview, copy);
    card.addEventListener("click", function () { chooseTemplate(item); });
    return card;
  }

  function voiceCard(item) {
    var card = document.createElement("div");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    var selected = item.voice_id
      ? customVoiceId.value === item.voice_id
      : !customVoiceId.value && voiceGender.value === item.gender && voiceAccent.value === item.accent;
    card.className = "b2v-library-card b2v-voice-card" + (selected ? " is-selected" : "");
    card.dataset.search = [item.name, item.gender, item.accent, item.description].join(" ").toLowerCase();
    var avatar = document.createElement("span");
    avatar.className = "b2v-voice-avatar";
    avatar.textContent = text(item.name, "V").charAt(0).toUpperCase();
    var copy = document.createElement("span");
    copy.className = "b2v-card-copy";
    var name = document.createElement("strong");
    name.textContent = text(item.name, "Voice");
    var description = document.createElement("span");
    description.textContent = [item.gender, item.accent].filter(Boolean).join(" · ") || text(item.description, "Narration voice");
    copy.append(name, description);
    card.append(avatar, copy);
    if (item.preview_url) {
      var play = document.createElement("button");
      play.type = "button";
      play.className = "b2v-voice-play";
      play.textContent = "▶";
      play.setAttribute("aria-label", "Preview " + text(item.name, "voice"));
      play.addEventListener("click", function (event) { playVoice(event, item); });
      card.appendChild(play);
    }
    card.addEventListener("click", function () { chooseVoice(item); });
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseVoice(item);
      }
    });
    return card;
  }

  function matchesQuery(item, query) {
    if (!query) return true;
    var haystack = libraryMode === "templates"
      ? [item.name, item.id, item.description, (item.genres || []).join(" ")]
      : [item.name, item.gender, item.accent, item.description];
    return haystack.join(" ").toLowerCase().includes(query);
  }

  function renderPage() {
    var query = librarySearch.value.trim().toLowerCase();
    var filtered = libraryAllItems.filter(function (item) { return matchesQuery(item, query); });

    libraryGrid.textContent = "";
    filtered.forEach(function (item) {
      libraryGrid.appendChild(libraryMode === "templates" ? templateCard(item) : voiceCard(item));
    });
    libraryEmpty.hidden = Boolean(filtered.length);
  }

  function renderLibrary(catalog) {
    if (libraryMode === "templates") {
      libraryAllItems = catalog.templates || [];
    } else {
      libraryAllItems = catalog.voices || [];
    }
    renderPage();
  }

  function renderWizardCatalog(catalog, stylesResponse) {
    var templates = catalog.templates || [];
    var stylesById = new Map(((stylesResponse && stylesResponse.styles) || []).map(function (item) {
      return [String(item.id), item];
    }));
    var videoStyles = [];
    if (stylesResponse && stylesResponse.auto_style) videoStyles.push(stylesResponse.auto_style);
    ((stylesResponse && stylesResponse.selected_ids) || []).forEach(function (id) {
      var style = stylesById.get(String(id));
      if (style) videoStyles.push(style);
    });
    var voices = catalog.voices || [];
    if (wizardTemplateLoading) wizardTemplateLoading.hidden = true;
    if (wizardTemplateGrid) {
      wizardTemplateGrid.textContent = "";
      templates.forEach(function (item) {
        var card = templateCard(item);
        card.dataset.templateId = text(item.id, "default");
        card.classList.add("b2v-wizard-template-card");
        wizardTemplateGrid.appendChild(card);
        var id = text(item.id, "default");
        var option = Array.prototype.find.call(templateSelect.options, function (entry) { return entry.value === id; });
        if (!option) {
          option = document.createElement("option");
          option.value = id;
          option.textContent = text(item.name, id);
          templateSelect.appendChild(option);
        }
      });
      if (wizardTemplateEmpty) wizardTemplateEmpty.hidden = Boolean(templates.length);
      var selected = templates.find(function (item) { return text(item.id, "default") === templateSelect.value; }) || templates[0];
      if (selected) chooseTemplate(selected);
    }
    if (wizardStyleLoading) wizardStyleLoading.hidden = true;
    if (wizardStyleGrid && wizardVideoStyle) {
      wizardStyleGrid.textContent = "";
      videoStyles.forEach(function (item) {
        var button = document.createElement("button");
        button.type = "button";
        button.dataset.styleId = text(item.id, "auto");
        button.textContent = text(item.name, item.id);
        button.title = text(item.description);
        button.addEventListener("click", function () {
          wizardVideoStyle.value = button.dataset.styleId;
          wizardStyleGrid.querySelectorAll("button").forEach(function (entry) {
            entry.classList.toggle("is-selected", entry === button);
          });
        });
        wizardStyleGrid.appendChild(button);
      });
      var selectedStyle = Array.prototype.find.call(wizardStyleGrid.querySelectorAll("button"), function (button) {
        return button.dataset.styleId === wizardVideoStyle.value;
      }) || wizardStyleGrid.querySelector("button");
      if (selectedStyle) {
        wizardVideoStyle.value = selectedStyle.dataset.styleId;
        selectedStyle.classList.add("is-selected");
      }
      wizardStyleGrid.hidden = !videoStyles.length;
      if (wizardStyleEmpty) wizardStyleEmpty.hidden = Boolean(videoStyles.length);
    }
    if (wizardVoiceLoading) wizardVoiceLoading.hidden = true;
    if (wizardVoiceList) {
      wizardVoiceList.textContent = "";
      voices.forEach(function (item) {
        var card = voiceCard(item);
        card.dataset.voiceId = String(item.voice_id || "");
        card.classList.add("b2v-wizard-voice-card");
        wizardVoiceList.appendChild(card);
      });
      if (wizardVoiceEmpty) wizardVoiceEmpty.hidden = Boolean(voices.length);
      if (voices.length && !customVoiceId.value) chooseVoice(voices[0]);
    }
  }

  function loadWizardCatalog() {
    if (!wizardTemplateGrid && !wizardStyleGrid && !wizardVoiceList) return;
    loadCatalog().then(function (catalog) {
      if (catalog.video_styles) return [catalog, catalog.video_styles];
      return loadVideoStyles().then(function (styles) { return [catalog, styles]; });
    }).then(function (results) {
      renderWizardCatalog(results[0], results[1]);
    }).catch(function (error) {
      if (wizardTemplateLoading) wizardTemplateLoading.hidden = true;
      if (wizardStyleLoading) wizardStyleLoading.hidden = true;
      if (wizardVoiceLoading) wizardVoiceLoading.hidden = true;
      if (wizardTemplateEmpty) { wizardTemplateEmpty.hidden = false; wizardTemplateEmpty.textContent = errorText(error); }
      if (wizardStyleGrid) wizardStyleGrid.hidden = true;
      if (wizardStyleEmpty) { wizardStyleEmpty.hidden = false; wizardStyleEmpty.textContent = "Could not load your saved video styles. Refresh after the Blog2Video backend is updated."; }
      if (wizardVoiceEmpty) { wizardVoiceEmpty.hidden = false; wizardVoiceEmpty.textContent = errorText(error); }
    });
  }

  function openLibrary(mode) {
    libraryMode = mode;
    libraryModal.classList.toggle("is-compact", Boolean(libraryTemplateChangeIsLive || libraryVoiceChangeIsLive));
    libraryTitle.textContent = mode === "templates" ? "Choose a template" : "Choose a voiceover";
    librarySearch.value = "";
    libraryAllItems = [];
    libraryGrid.innerHTML = '<div class="b2v-library-loading"><span></span>Loading library…</div>';
    libraryEmpty.hidden = true;
    libraryModal.hidden = false;
    document.body.classList.add("b2v-library-open");
    loadCatalog().then(renderLibrary).catch(function (error) {
      libraryGrid.textContent = "";
      libraryEmpty.textContent = errorText(error);
      libraryEmpty.hidden = false;
    });
    setTimeout(function () { librarySearch.focus(); }, 0);
  }
  function pollGeneration() {
    clearTimeout(timer);
    wp.apiFetch({ path: base + "/status" }).then(function (data) {
      var label = data.error ? "Failed: " + data.error : "Generation: " + (data.status || "working") + (data.running ? "…" : "");
      message(label, Boolean(data.error), Boolean(data.running));
      if (data.error) {
        showOperation("Video generation failed", data.error, "error");
      } else if (data.running) {
        showOperation("Creating your video", data.progress != null ? "Generating scenes — " + data.progress + "%" : "Generating scenes…");
      }
      if (data.editor_available || data.project_id) markProjectAvailable(data.project_id);
      if (data.error) {
        setButtonBusy(generate, false);
        generate.removeAttribute("aria-busy");
        if (generateLabel) generateLabel.textContent = "Generate video";
        return;
      }
      if (data.r2_video_url) {
        if (downloadVideo) {
          downloadVideo.dataset.videoUrl = data.r2_video_url;
          downloadVideo.hidden = false;
        }
        showOperation("Video ready", "Your generated video is ready to review.", "complete");
        showEmbedPrompt();
        return;
      }
      if (String(data.status).toLowerCase().includes("awaiting_stock_footage")) {
        message("Review the selected stock footage in the Blog2Video editor, then return here.");
        return;
      }
      if (data.running || !["generated", "completed", "done"].includes(String(data.status).toLowerCase())) {
        timer = setTimeout(pollGeneration, 5000);
      } else {
        setButtonBusy(generate, false);
        generate.removeAttribute("aria-busy");
        if (generateLabel) generateLabel.textContent = "Generate video";
        render.hidden = false;
        setButtonBusy(render, false);
        setEmbedReady(true);
        message("Video ready. Edit scenes, adjust settings and regenerate, or continue to Render.");
        showOperation("Video ready", "Your scenes are ready to review and edit.", "complete");
        refreshEmbeddedPreviews();
      }
    }).catch(function (error) {
      setButtonBusy(generate, false);
      generate.removeAttribute("aria-busy");
      if (generateLabel) generateLabel.textContent = "Generate video";
      var detail = errorText(error);
      message(detail, true);
      showOperation("Could not check generation", detail, "error");
    });
  }
  function pollRender() {
    clearTimeout(timer);
    wp.apiFetch({ path: base + "/render-status" }).then(function (data) {
      var state = String(data.status || data.render_status || "rendering").toLowerCase();
      message("Rendering video" + (data.progress != null ? " — " + data.progress + "%" : "…"), false, !data.done);
      setProgress(data.progress);
      if (data.r2_video_url || ["completed", "rendered", "done"].includes(state)) {
        if (data.r2_video_url && downloadVideo) {
          downloadVideo.dataset.videoUrl = data.r2_video_url;
          downloadVideo.hidden = false;
        }
        showEmbedPrompt();
      } else if (data.error || ["failed", "error"].includes(state)) {
        message(data.error || "Rendering failed.", true);
        setProgress(null);
        setButtonBusy(render, false);
      } else if (data.done) {
        message("Rendering finished, but no video URL was returned. Try Render again.", true);
        setProgress(null);
        setButtonBusy(render, false);
      } else {
        timer = setTimeout(pollRender, 6000);
      }
    }).catch(function (error) { message(errorText(error), true); });
  }
  function triggerDownload(url) {
    if (!url) return;
    var link = document.createElement("a");
    link.href = url + (url.indexOf("?") === -1 ? "?" : "&") + "cb=" + Date.now();
    link.setAttribute("download", (Blog2VideoAdmin.projectName || "video").replace(/\s+/g, "_") + ".mp4");
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  if (downloadVideo) {
    downloadVideo.addEventListener("click", function () { triggerDownload(downloadVideo.dataset.videoUrl); });
  }
  function logoMessageText(value, error) {
    if (!logoMessage) return;
    logoMessage.textContent = value || "";
    logoMessage.classList.toggle("is-error", Boolean(error));
  }
  function renderLogoState(project) {
    var url = project && project.logo_r2_url;
    if (logoPreview) logoPreview.hidden = !url;
    if (logoPreviewImage) logoPreviewImage.src = url || "";
    if (logoEmpty) logoEmpty.hidden = Boolean(url);
    if (logoRemove) logoRemove.hidden = !url;
    if (logoSettings) logoSettings.hidden = !url;
    if (url) {
      if (logoPosition) logoPosition.value = project.logo_position || "bottom_right";
      if (logoSize) logoSize.value = project.logo_size != null ? project.logo_size : 100;
      if (logoOpacity) logoOpacity.value = project.logo_opacity != null ? project.logo_opacity : 0.9;
    }
  }
  if (logoInput) {
    logoInput.addEventListener("change", function () {
      if (!logoInput.files || !logoInput.files[0]) return;
      var file = logoInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        logoMessageText("Logo file too large. Maximum size is 2 MB.", true);
        logoInput.value = "";
        return;
      }
      var data = new FormData();
      data.append("logo", file, file.name);
      setButtonBusy(logoChoose, true);
      logoMessageText("Uploading logo…");
      wp.apiFetch({ path: base + "/logo", method: "POST", body: data }).then(function () {
        logoMessageText("Logo uploaded.");
        return wp.apiFetch({ path: base + "/editor" }).then(renderLogoState);
      }).catch(function (error) {
        logoMessageText(errorText(error), true);
        toggleUpgradeSlot(error);
      }).finally(function () {
        setButtonBusy(logoChoose, false);
        logoInput.value = "";
      });
    });
  }
  if (logoRemove) {
    logoRemove.addEventListener("click", function () {
      confirmAction("Remove this logo?", "The logo will be removed from this video project.", "Remove logo").then(function (accepted) {
        if (!accepted) return;
        setButtonBusy(logoRemove, true);
        logoMessageText("Removing logo…");
        wp.apiFetch({ path: base + "/logo", method: "DELETE" }).then(function () {
          logoMessageText("Logo removed.");
          renderLogoState({});
        }).catch(function (error) { logoMessageText(errorText(error), true); })
          .finally(function () { setButtonBusy(logoRemove, false); });
      });
    });
  }
  function saveLogoSettings() {
    if (!logoLoaded) return;
    wp.apiFetch({
      path: base + "/logo",
      method: "PATCH",
      data: {
        logo_position: logoPosition ? logoPosition.value : undefined,
        logo_size: logoSize ? Number(logoSize.value) : undefined,
        logo_opacity: logoOpacity ? Number(logoOpacity.value) : undefined
      }
    }).then(function () {
      logoMessageText("Logo settings saved.");
    }).catch(function (error) { logoMessageText(errorText(error), true); });
  }
  if (logoPosition) logoPosition.addEventListener("change", saveLogoSettings);
  if (logoSize) logoSize.addEventListener("change", saveLogoSettings);
  if (logoOpacity) logoOpacity.addEventListener("change", saveLogoSettings);

  function wizardLogoMessageText(value, error) {
    if (!wizardLogoMessage) return;
    wizardLogoMessage.textContent = value || "";
    wizardLogoMessage.classList.toggle("is-error", Boolean(error));
  }
  function clearStagedLogo() {
    stagedLogoFile = null;
    if (wizardLogoInput) wizardLogoInput.value = "";
    if (wizardLogoPreview) wizardLogoPreview.hidden = true;
    if (wizardLogoFilename) wizardLogoFilename.textContent = "";
    if (wizardLogoSettings) wizardLogoSettings.hidden = true;
  }
  if (wizardLogoInput) {
    wizardLogoInput.addEventListener("change", function () {
      if (!wizardLogoInput.files || !wizardLogoInput.files[0]) return;
      var file = wizardLogoInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        wizardLogoMessageText("Logo file too large. Maximum size is 2 MB.", true);
        wizardLogoInput.value = "";
        return;
      }
      stagedLogoFile = file;
      wizardLogoMessageText("");
      if (wizardLogoPreview) wizardLogoPreview.hidden = false;
      if (wizardLogoFilename) wizardLogoFilename.textContent = file.name;
      if (wizardLogoSettings) wizardLogoSettings.hidden = false;
    });
  }
  if (wizardLogoRemove) {
    wizardLogoRemove.addEventListener("click", function () {
      clearStagedLogo();
      wizardLogoMessageText("");
    });
  }
  function uploadStagedLogo(logoBase) {
    if (!stagedLogoFile) return;
    var file = stagedLogoFile;
    var position = wizardLogoPosition ? wizardLogoPosition.value : undefined;
    var opacity = wizardLogoOpacity ? Number(wizardLogoOpacity.value) : undefined;
    clearStagedLogo();
    var data = new FormData();
    data.append("logo", file, file.name);
    wp.apiFetch({ path: logoBase + "/logo", method: "POST", body: data }).then(function () {
      return wp.apiFetch({ path: logoBase + "/logo", method: "PATCH", data: { logo_position: position, logo_opacity: opacity } });
    }).catch(function (error) {
      message("Logo upload failed: " + errorText(error), true);
    });
  }

  function loadWizardMusicTracks() {
    if (!wizardMusicTrack || wizardMusicTracksLoaded) return;
    wizardMusicTracksLoaded = true;
    wizardMusicTrack.disabled = true;
    wizardMusicTrack.options[0].textContent = "Loading background music…";
    wp.apiFetch({ path: base + "/music-tracks" }).then(function (tracks) {
      wizardMusicTrack.options[0].textContent = "No background music";
      (tracks || []).forEach(function (track) {
        var option = document.createElement("option");
        option.value = track.track_id;
        option.textContent = track.display_name + (track.mood ? " · " + track.mood : "");
        option.dataset.url = track.r2_url || "";
        wizardMusicTrack.appendChild(option);
      });
      wizardMusicTrack.disabled = false;
    }).catch(function (error) {
      wizardMusicTracksLoaded = false;
      wizardMusicTrack.options[0].textContent = "Could not load background music";
      message(errorText(error), true);
    });
  }

  if (noVoiceover) {
    noVoiceover.addEventListener("change", function () {
      if (noVoiceover.checked) {
        voiceGender.value = "none";
        voiceAccent.value = "american";
        customVoiceId.value = "";
        selectedVoice.textContent = "No voiceover";
      } else if (voiceGender.value === "none") {
        voiceGender.value = "female";
        selectedVoice.textContent = "Select a voice";
      }
      if (wizardVoiceList) wizardVoiceList.classList.toggle("is-disabled", noVoiceover.checked);
    });
  }

  function loadProjectSettings() {
    settingsLoaded = false;
    logoLoaded = false;
    if (styleLoading) styleLoading.hidden = false;
    if (styleFields) styleFields.hidden = true;
    if (colorsMessage) {
      colorsMessage.textContent = "";
      colorsMessage.classList.remove("is-error");
    }
    if (modalSelectedTemplate) modalSelectedTemplate.textContent = "Loading…";
    if (modalSelectedVoice) modalSelectedVoice.textContent = "Loading…";
    wp.apiFetch({ path: base + "/editor" }).then(function (project) {
      settingsLoaded = true;
      logoLoaded = true;
      renderLogoState(project);
      if (colorAccent) colorAccent.value = safeColor(project.accent_color, "#9333ea");
      if (colorBg) colorBg.value = safeColor(project.bg_color, "#FFFFFF");
      if (colorText) colorText.value = safeColor(project.text_color, "#000000");
      if (fontFamily) fontFamily.value = normalizedSelectValue(fontFamily, project.font_family, "");
      if (captionsToggle) captionsToggle.checked = Boolean(project.captions_enabled);
      if (captionFont) captionFont.value = normalizedSelectValue(captionFont, project.caption_font_family, "inter");
      if (captionSize) captionSize.value = project.caption_font_size ? Number(project.caption_font_size) || 36 : 36;
      if (captionOffset) captionOffset.value = typeof project.caption_offset === "number" ? project.caption_offset : 0;
      pendingMusicTrackId = project.bgm_track_id || "";
      if (musicTrack) musicTrack.value = pendingMusicTrackId;
      if (musicVolume) musicVolume.value = project.bgm_volume != null ? project.bgm_volume : 0.1;
      updateMusicPlayState();
      var templateReady = loadCatalog().then(function (catalog) {
        var current = text(project.template, "default");
        var templates = catalog.templates || [];
        var match = templates.find(function (item) { return text(item.id) === current; });
        var templateName = match ? text(match.name, current) : current.replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
        if (templateSelect) {
          var option = Array.prototype.find.call(templateSelect.options, function (entry) { return entry.value === current; });
          if (!option) {
            option = document.createElement("option");
            option.value = current;
            option.textContent = templateName;
            templateSelect.appendChild(option);
          }
          templateSelect.value = current;
        }
        if (modalTemplateSelect) {
          modalTemplateSelect.value = current;
          modalTemplateSelect.dataset.current = current;
        }
        if (modalSelectedTemplate) modalSelectedTemplate.textContent = templateName;
        if (selectedTemplate) selectedTemplate.textContent = templateName;
      });
      var voiceReady = modalSelectedVoice
        ? loadCatalog().then(function (catalog) {
            var voices = catalog.voices || [];
            var match = null;
            for (var i = 0; i < voices.length; i++) {
              if (String(voices[i].voice_id || "") === String(project.custom_voice_id || "")) { match = voices[i]; break; }
            }
            var voiceLabel = text(project.voice_name);
            if (!voiceLabel) {
              voiceLabel = match
                ? text(match.name, match.voice_id)
                : (project.voice_gender === "none" ? "No voice" : "Selected voice");
            }
            modalSelectedVoice.textContent = voiceLabel;
            if (selectedVoice) selectedVoice.textContent = voiceLabel;
          })
        : Promise.resolve();
      Promise.all([templateReady, voiceReady]).then(function () {
        if (styleLoading) styleLoading.hidden = true;
        if (styleFields) styleFields.hidden = false;
      }).catch(function (error) {
        if (styleLoading) styleLoading.hidden = true;
        if (styleFields) styleFields.hidden = false;
        if (modalSelectedTemplate) modalSelectedTemplate.textContent = text(project.template, "default");
        if (modalSelectedVoice) modalSelectedVoice.textContent = project.voice_gender === "none" ? "No voice" : "Selected voice unavailable";
        if (colorsMessage) {
          colorsMessage.textContent = "Project loaded, but its template and voice names could not be loaded: " + errorText(error);
          colorsMessage.classList.add("is-error");
        }
      });
    }).catch(function (error) {
      settingsLoaded = true;
      logoLoaded = true;
      if (styleLoading) styleLoading.hidden = true;
      if (styleFields) styleFields.hidden = false;
      if (modalSelectedTemplate) modalSelectedTemplate.textContent = "Could not load project";
      if (modalSelectedVoice) modalSelectedVoice.textContent = "Could not load project";
      if (colorsMessage) {
        colorsMessage.textContent = errorText(error);
        colorsMessage.classList.add("is-error");
      }
    });
  }

  var templateOptionsLoaded = false;
  var pendingMusicTrackId = "";
  function loadTemplateOptions() {
    if (templateOptionsLoaded) return Promise.resolve();
    return loadCatalog().then(function (catalog) {
      templateOptionsLoaded = true;
      if (!modalTemplateSelect) return;
      modalTemplateSelect.innerHTML = "";
      (catalog.templates || []).forEach(function (item) {
        var option = document.createElement("option");
        option.value = text(item.id, "default");
        option.textContent = text(item.name, item.id);
        modalTemplateSelect.appendChild(option);
      });
    }).catch(function () {});
  }

  function updateMusicPlayState() {
    if (!musicPlay || !musicTrack) return;
    musicPlay.disabled = !musicTrack.value;
  }

  function loadMusicTracks() {
    if (musicTracksLoaded || !musicTrack) return;
    musicTracksLoaded = true;
    wp.apiFetch({ path: base + "/music-tracks" }).then(function (tracks) {
      (tracks || []).forEach(function (track) {
        var option = document.createElement("option");
        option.value = track.track_id;
        option.textContent = track.display_name;
        option.dataset.url = track.r2_url;
        musicTrack.appendChild(option);
      });
      musicTrack.value = pendingMusicTrackId;
      updateMusicPlayState();
    }).catch(function () {});
  }

  if (musicTrack) musicTrack.addEventListener("change", function () {
    updateMusicPlayState();
    if (musicAudio) { musicAudio.pause(); musicAudio = null; }
    if (musicPlay) { musicPlay.classList.remove("is-playing"); musicPlay.textContent = "▶"; }
  });

  if (musicPlay) {
    musicPlay.addEventListener("click", function () {
      var option = musicTrack.options[musicTrack.selectedIndex];
      var url = option && option.dataset.url;
      if (!url) return;
      if (musicAudio) {
        musicAudio.pause();
        musicAudio = null;
        musicPlay.classList.remove("is-playing");
        musicPlay.textContent = "▶";
        return;
      }
      musicAudio = new Audio(url);
      musicPlay.classList.add("is-playing");
      musicPlay.textContent = "■";
      musicAudio.addEventListener("ended", function () {
        musicPlay.classList.remove("is-playing");
        musicPlay.textContent = "▶";
        musicAudio = null;
      });
      musicAudio.play().catch(function () {
        musicPlay.classList.remove("is-playing");
        musicPlay.textContent = "▶";
      });
    });
  }

  function openProjectSettingsModal() {
    if (!projectSettingsModal) return;
    projectSettingsModal.hidden = false;
    document.body.classList.add("b2v-editor-open");
    loadProjectSettings();
    loadMusicTracks();
  }

  function closeProjectSettingsModal() {
    if (!projectSettingsModal) return;
    projectSettingsModal.hidden = true;
    document.body.classList.remove("b2v-editor-open");
    if (musicAudio) { musicAudio.pause(); musicAudio = null; }
    if (musicPlay) { musicPlay.classList.remove("is-playing"); musicPlay.textContent = "▶"; }
  }

  if (openProjectSettings) openProjectSettings.addEventListener("click", openProjectSettingsModal);
  if (modalBrowseTemplates) modalBrowseTemplates.addEventListener("click", function () {
    libraryTemplateChangeIsLive = true;
    libraryVoiceChangeIsLive = false;
    openLibrary("templates");
  });
  if (projectSettingsModal) {
    projectSettingsModal.querySelectorAll("[data-b2v-close-project-settings]").forEach(function (button) {
      button.addEventListener("click", closeProjectSettingsModal);
    });
  }

  function saveProjectSettings(data, messageEl, successText, busyButton) {
    if (!settingsLoaded) return;
    setButtonBusy(busyButton, true);
    wp.apiFetch({ path: base + "/settings", method: "PATCH", data: data }).then(function () {
      if (messageEl) {
        messageEl.textContent = successText;
        messageEl.classList.remove("is-error");
      }
    }).catch(function (error) {
      if (messageEl) {
        messageEl.textContent = errorText(error);
        messageEl.classList.add("is-error");
      }
      toggleUpgradeSlot(error);
    }).finally(function () { setButtonBusy(busyButton, false); });
  }

  if (colorsSave) {
    colorsSave.addEventListener("click", function () {
      saveProjectSettings({
        accent_color: colorAccent ? colorAccent.value : undefined,
        bg_color: colorBg ? colorBg.value : undefined,
        text_color: colorText ? colorText.value : undefined,
        font_family: fontFamily ? (fontFamily.value || null) : undefined
      }, colorsMessage, "Colors & font saved.", colorsSave);
    });
  }

  if (captionsSave) {
    captionsSave.addEventListener("click", function () {
      saveProjectSettings({
        captions_enabled: captionsToggle ? captionsToggle.checked : undefined,
        caption_font_family: captionFont ? captionFont.value : undefined,
        caption_font_size: captionSize ? Number(captionSize.value) : undefined,
        caption_offset: captionOffset ? Number(captionOffset.value) : undefined
      }, captionsMessage, "Caption settings saved.", captionsSave);
    });
  }

  if (musicSave) {
    musicSave.addEventListener("click", function () {
      saveProjectSettings({
        bgm_track_id: musicTrack ? (musicTrack.value || null) : undefined,
        bgm_volume: musicVolume ? Number(musicVolume.value) : undefined
      }, musicMessage, "Music settings saved.", musicSave);
    });
  }

  function findVideoBlock(blocks) {
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.name === "blog2video/video") return block;
      if (block.innerBlocks && block.innerBlocks.length) {
        var found = findVideoBlock(block.innerBlocks);
        if (found) return found;
      }
    }
    return null;
  }

  function hasExistingVideo() {
    if (embedded || Boolean(Blog2VideoAdmin.hasEmbed)) return true;
    if (window.wp.data && window.wp.blocks) {
      return Boolean(findVideoBlock(wp.data.select("core/block-editor").getBlocks()));
    }
    return false;
  }

  function restoreProjectFromEmbeddedBlock(attempt) {
    // Blog2VideoAdmin.projectId may already be set optimistically (from the block's own
    // saved attribute, written by PHP without a network call) — that is not the
    // same as this WordPress connection actually being linked to the project on
    // the backend. Always resolve/link once per load so requests like /status
    // that require a confirmed link don't 404 against an optimistic id.
    if (!postId || !window.wp.data || !window.wp.blocks) return;
    var editorStore = wp.data.select("core/block-editor");
    var blocks = editorStore && editorStore.getBlocks ? editorStore.getBlocks() : [];
    var existingBlock = findVideoBlock(blocks || []);
    if (!existingBlock) {
      if ((attempt || 0) < 40) {
        window.setTimeout(function () { restoreProjectFromEmbeddedBlock((attempt || 0) + 1); }, 250);
      }
      return;
    }
    var embedUrl = existingBlock.attributes && existingBlock.attributes.embedUrl;
    if (!embedUrl) return;

    wp.apiFetch({
      path: base + "/projects/resolve-embed",
      method: "POST",
      data: { embed_url: embedUrl }
    }).then(function (project) {
      embedded = true;
      Blog2VideoAdmin.hasEmbed = true;
      markProjectAvailable(project.project_id, project.name);
      var dispatch = wp.data.dispatch("core/block-editor");
      if (dispatch && dispatch.updateBlockAttributes) {
        dispatch.updateBlockAttributes(existingBlock.clientId, {
          projectId: Number(project.project_id) || 0,
          projectName: project.name || ""
        });
      }
      setEmbedReady(true);
      updateEmbedLabel();
      loadProjectLibrary(false);
      message("Embedded video project loaded. You can edit its settings from this panel.");
      pollGeneration();
    }).catch(function (error) {
      message("Could not load the embedded video project. " + errorText(error), true);
      if (window.Blog2VideoResolveFailed) window.Blog2VideoResolveFailed();
    });
  }

  function createEmbed(triggerButton, closeProjectsAfter) {
    var busyButton = triggerButton && triggerButton.nodeType === 1 ? triggerButton : embed;
    setButtonBusy(busyButton, true);
    message("Adding the video to this post…", false, true);
    wp.apiFetch({ path: base + "/embed", method: "POST" }).then(function (data) {
      embedded = true;
      setEmbedReady(true);
      setButtonBusy(busyButton, false);
      updateEmbedLabel();
      if (closeProjectsAfter) closeProjectLibrary();
      if (window.wp.data && window.wp.blocks) {
        var dispatch = wp.data.dispatch("core/block-editor");
        var existingBlock = findVideoBlock(wp.data.select("core/block-editor").getBlocks());
        var blockAttributes = {
          embedUrl: data.preview_url,
          projectId: Number(Blog2VideoAdmin.projectId) || 0,
          projectName: Blog2VideoAdmin.projectName || ""
        };
        if (existingBlock && dispatch && dispatch.updateBlockAttributes) {
          dispatch.updateBlockAttributes(existingBlock.clientId, blockAttributes);
          message("“" + (Blog2VideoAdmin.projectName || "Video") + "” updated in the existing block. Click Update to publish it.");
          return;
        }
        if (dispatch && dispatch.insertBlocks) {
          dispatch.insertBlocks(wp.blocks.createBlock("blog2video/video", blockAttributes));
          message("“" + (Blog2VideoAdmin.projectName || "Video") + "” added as a new block. Click Update to publish it.");
          return;
        }
      }
      message("Video is linked to this post.");
    }).catch(function (error) {
      setButtonBusy(busyButton, false);
      message(errorText(error), true);
    });
  }

  function removeEmbed() {
    setButtonBusy(embed, true);
    message("Removing the video from this post…", false, true);
    wp.apiFetch({ path: base + "/embed", method: "DELETE" }).then(function () {
      embedded = false;
      if (window.wp.data && window.wp.blocks) {
        var dispatch = wp.data.dispatch("core/block-editor");
        var existingBlock = findVideoBlock(wp.data.select("core/block-editor").getBlocks());
        if (existingBlock && dispatch && dispatch.removeBlock) {
          dispatch.removeBlock(existingBlock.clientId);
        }
      }
      setButtonBusy(embed, false);
      updateEmbedLabel();
      message("Video removed from this post. Click Update to publish the change.");
    }).catch(function (error) {
      setButtonBusy(embed, false);
      message(errorText(error), true);
    });
  }

  if (sourceType) sourceType.addEventListener("change", updateSourceFields);
  browseTemplates.addEventListener("click", function () {
    libraryTemplateChangeIsLive = false;
    libraryVoiceChangeIsLive = false;
    openLibrary("templates");
  });
  browseVoices.addEventListener("click", function () {
    libraryTemplateChangeIsLive = false;
    libraryVoiceChangeIsLive = false;
    openLibrary("voices");
  });
  if (modalTemplateSelect) modalTemplateSelect.addEventListener("change", function () {
    var id = modalTemplateSelect.value;
    if (!id) return;
    var option = modalTemplateSelect.options[modalTemplateSelect.selectedIndex];
    var name = option ? option.textContent : id;
    modalTemplateSelect.value = modalTemplateSelect.dataset.current || "";
    requestTemplateChange(id, name);
  });
  if (modalBrowseVoices) modalBrowseVoices.addEventListener("click", function () {
    libraryTemplateChangeIsLive = false;
    libraryVoiceChangeIsLive = true;
    openLibrary("voices");
  });
  libraryModal.querySelectorAll("[data-b2v-close-library]").forEach(function (button) {
    button.addEventListener("click", closeLibrary);
  });
  librarySearch.addEventListener("input", function () {
    libraryEmpty.textContent = "No matching options found.";
    renderPage();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && confirmModal && !confirmModal.hidden) {
      settleConfirmation(false);
      quotaPromptPending = false;
      return;
    }
    if (event.key === "Escape" && !libraryModal.hidden) closeLibrary();
    if (event.key === "Escape" && !projectModal.hidden) closeProjectLibrary();
    if (event.key === "Escape" && projectSettingsModal && !projectSettingsModal.hidden) closeProjectSettingsModal();
  });
  browseProjects.addEventListener("click", openProjectLibrary);
  projectModal.querySelectorAll("[data-b2v-close-projects]").forEach(function (button) {
    button.addEventListener("click", closeProjectLibrary);
  });
  projectSearch.addEventListener("input", renderProjectLibrary);

  applyInitialProjectState();
  restoreProjectFromEmbeddedBlock(0);
  updateSourceFields();
  loadWizardCatalog();
  loadWizardMusicTracks();
  loadAccount().catch(function () {
    // Generation remains protected by the backend quota gate even if this
    // display-only preflight request is temporarily unavailable.
  });
  if (Number(Blog2VideoAdmin.projectId)) {
    loadProjectLibrary(false);
  }
  render.addEventListener("click", function () {
    setButtonBusy(render, true);
    message("Starting final render…", false, true);
    toggleUpgradeSlot(null);
    wp.apiFetch({ path: base + "/render", method: "POST" }).then(pollRender).catch(function (error) {
      setButtonBusy(render, false);
      showUpgradePrompt(error);
    });
  });
  embed.addEventListener("click", function () {
    if (hasExistingVideo()) {
      removeEmbed();
    } else {
      createEmbed();
    }
  });
  updateEmbedLabel();
  // A project id recovered from the embedded block's own attribute is optimistic
  // until restoreProjectFromEmbeddedBlock() confirms the WordPress↔project link on
  // the backend; polling status against it too early 404s. Only auto-poll here for
  // a project id we already know is backend-confirmed (no unresolved embed).
  if (status.textContent.trim() || (Number(Blog2VideoAdmin.projectId) && !Blog2VideoAdmin.hasEmbed)) pollGeneration();
  panel.dataset.b2vInitialized = "true";
  return true;
};
