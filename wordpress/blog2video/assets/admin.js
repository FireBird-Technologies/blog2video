window.B2VInitAdmin = function () {
  "use strict";
  var panel = document.getElementById("b2v-panel");
  if (!panel || !window.wp || !wp.apiFetch) return;
  var postId = Number(B2VAdmin.postId);
  var base = B2VAdmin.root + postId;
  var status = document.getElementById("b2v-status");
  var statusCard = document.getElementById("b2v-status-card");
  var progress = document.getElementById("b2v-progress");
  var generate = document.getElementById("b2v-generate");
  var settingsGrid = document.getElementById("b2v-settings-grid");
  var generateWarning = document.getElementById("b2v-generate-warning");
  var generateActions = document.getElementById("b2v-generate-actions");
  var sourceSection = document.getElementById("b2v-source-section");
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
  var editor = document.getElementById("b2v-editor");
  var editorModal = document.getElementById("b2v-editor-modal");
  var editorLoading = document.getElementById("b2v-editor-loading");
  var sceneGroups = document.getElementById("b2v-scene-groups");
  var sceneCount = document.getElementById("b2v-scene-count");
  var sceneMessage = document.getElementById("b2v-scene-message");
  var addSceneButton = document.getElementById("b2v-add-scene");
  var activeProjectName = document.getElementById("b2v-active-project-name");
  var activeProjectId = document.getElementById("b2v-active-project-id");
  var editorProjectLabel = document.getElementById("b2v-editor-project-label");
  var browseProjects = document.getElementById("b2v-browse-projects");
  var projectModal = document.getElementById("b2v-project-modal");
  var projectSearch = document.getElementById("b2v-project-search");
  var projectGrid = document.getElementById("b2v-project-grid");
  var projectEmpty = document.getElementById("b2v-project-empty");
  var editorTabs = editorModal.querySelectorAll("[data-editor-tab]");
  var editorPanes = editorModal.querySelectorAll("[data-editor-pane]");
  var scriptGroups = document.getElementById("b2v-script-groups");
  var scriptSummary = document.getElementById("b2v-script-summary");
  var scriptMessage = document.getElementById("b2v-script-message");
  var scriptRegenerate = document.getElementById("b2v-script-regenerate");
  var scriptInstruction = document.getElementById("b2v-script-instruction");
  var scriptRegenerateToggle = document.getElementById("b2v-script-regenerate-toggle");
  var scriptRegenerateStart = document.getElementById("b2v-script-regenerate-start");
  var scriptRegenerateCancel = document.getElementById("b2v-script-regenerate-cancel");
  var scriptReview = document.getElementById("b2v-script-review");
  var sourceType = document.getElementById("b2v-source-type");
  var sourceUrl = document.getElementById("b2v-source-url");
  var sourceUrlWrap = document.getElementById("b2v-source-url-wrap");
  var postSourceHelp = document.getElementById("b2v-post-source-help");
  var templateSelect = document.getElementById("b2v-template");
  var selectedTemplate = document.getElementById("b2v-selected-template");
  var modalSelectedTemplate = document.getElementById("b2v-modal-selected-template");
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
  var colorAccent = document.getElementById("b2v-color-accent");
  var colorBg = document.getElementById("b2v-color-bg");
  var colorText = document.getElementById("b2v-color-text");
  var fontFamily = document.getElementById("b2v-font-family");
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
  var musicTracksLoaded = false;
  var musicAudio;
  var settingsLoaded = false;
  var timer;
  var embedded = Boolean(B2VAdmin.hasEmbed);
  var catalogPromise;
  var accountPromise;
  var aiCreditsAvailable = null;
  var VOICEOVER_EDIT_CREDIT_COST = 5;
  var libraryMode = "templates";
  var activeAudio;
  var libraryAllItems = [];
  var editorScenes = [];
  var editorAssets = [];
  var editorLayouts = [];
  var editorLayoutNames = {};
  var editorLayoutSchema = {};
  var editorAspectRatio = "landscape";
  var activeSceneId = null;
  var scriptPollTimer = null;
  var availableProjects = [];
  var projectLibraryPage = 1;
  var projectLibraryHasMore = false;
  var projectLibraryLoading = false;

  // Gutenberg places meta boxes inside containers that establish their own
  // positioning/overflow context. Keeping a fixed modal inside that tree clips it
  // to the editor canvas and underneath the Post sidebar. Portal both dialogs to
  // <body> so they consistently cover the real browser viewport.
  document.body.appendChild(libraryModal);
  document.body.appendChild(editorModal);
  document.body.appendChild(projectModal);
  document.body.appendChild(projectSettingsModal);

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
    if (projectId) B2VAdmin.projectId = Number(projectId);
    if (projectName) B2VAdmin.projectName = projectName;
    if (activeProjectName) activeProjectName.textContent = B2VAdmin.projectName || "Selected Blog2Video project";
    if (activeProjectId) activeProjectId.textContent = Number(B2VAdmin.projectId) ? "Project #" + Number(B2VAdmin.projectId) : "Choose an existing video or create a new one below.";
    if (editorProjectLabel && Number(B2VAdmin.projectId)) editorProjectLabel.textContent = (B2VAdmin.projectName || "Blog2Video project") + " · Project #" + Number(B2VAdmin.projectId);
    if (refineCard && Number(B2VAdmin.projectId)) refineCard.hidden = false;
    if (projectSettingsCard && Number(B2VAdmin.projectId)) projectSettingsCard.hidden = false;
    if (Number(B2VAdmin.projectId)) {
      lockSettingsGrid();
      if (sourceSection) sourceSection.hidden = true;
      if (generateWarning) generateWarning.hidden = true;
      if (generateActions) generateActions.hidden = true;
      setEmbedReady(true);
    }
  }

  function applyInitialProjectState() {
    var hasProject = Number(B2VAdmin.projectId) > 0;
    if (hasProject) {
      markProjectAvailable(B2VAdmin.projectId, B2VAdmin.projectName);
      return;
    }

    B2VAdmin.projectId = 0;
    B2VAdmin.projectName = "";
    if (activeProjectName) activeProjectName.textContent = "No project selected";
    if (activeProjectId) activeProjectId.textContent = "Choose an existing video or create a new one below.";
    if (sourceSection) sourceSection.hidden = false;
    if (settingsGrid) settingsGrid.hidden = false;
    if (generateWarning) generateWarning.hidden = false;
    if (generateActions) generateActions.hidden = false;
    if (generate) generate.hidden = false;
    if (render) render.hidden = true;
    if (refineCard) refineCard.hidden = true;
    if (projectSettingsCard) projectSettingsCard.hidden = true;
    setEmbedReady(false);
  }

  function nativeEditorMessage(value, error) {
    sceneMessage.textContent = value || "";
    sceneMessage.classList.toggle("is-error", Boolean(error));
  }

  function sceneLayoutId(scene) {
    if (scene.preferred_layout) return scene.preferred_layout;
    try {
      var descriptor = JSON.parse(scene.remotion_code || "{}");
      return descriptor.layout || descriptor.layoutId || descriptor.layout_id || "";
    } catch (error) {
      return "";
    }
  }

  function sceneDescriptor(scene) {
    try {
      var parsed = JSON.parse(scene.remotion_code || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function sceneImage(scene) {
    var descriptor = sceneDescriptor(scene);
    var props = descriptor.layoutProps && typeof descriptor.layoutProps === "object" ? descriptor.layoutProps : {};
    if (props.hideImage || !props.assignedImage) return null;
    var filename = String(props.assignedImage);
    var asset = editorAssets.find(function (item) { return item.asset_type === "image" && item.filename === filename && !item.excluded; });
    var mediaBase = String(B2VAdmin.mediaBase || "").replace(/\/$/, "");
    return {
      filename: filename,
      url: asset && asset.r2_url ? asset.r2_url : mediaBase + "/media/projects/" + Number(B2VAdmin.projectId) + "/images/" + encodeURIComponent(filename)
    };
  }

  function appendSceneMedia(container, scene) {
    var image = sceneImage(scene);
    var preview = document.createElement("div");
    preview.className = "b2v-scene-image-preview" + (image ? " has-image" : "");
    if (image) {
      var img = document.createElement("img");
      img.src = image.url;
      img.alt = "Scene image";
      img.loading = "lazy";
      var copy = document.createElement("div");
      copy.innerHTML = "<strong>Scene image</strong><span></span>";
      copy.querySelector("span").textContent = image.filename;
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "b2v-icon-close b2v-image-remove";
      remove.dataset.action = "remove-image";
      remove.setAttribute("aria-label", "Remove scene image");
      remove.title = "Remove image from this scene";
      remove.textContent = "×";
      preview.append(img, copy, remove);
    } else {
      preview.innerHTML = '<span class="b2v-image-placeholder"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"></path><circle cx="9" cy="10" r="2"></circle><path d="m4 17 5-5 4 4 2-2 5 5"></path></svg></span><div><strong>No image assigned</strong><span>Add a PNG, JPEG or WebP image up to 5 MB.</span></div>';
    }
    var actions = document.createElement("div");
    actions.className = "b2v-scene-image-actions";
    var choose = document.createElement("button");
    choose.type = "button";
    choose.className = "button";
    choose.dataset.action = "choose-image";
    choose.textContent = image ? "Replace image" : "Add image";
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.hidden = true;
    input.dataset.sceneImageInput = "true";
    actions.append(choose, input);
    container.append(preview, actions);
  }

  function sceneById(sceneId) {
    return editorScenes.find(function (scene) { return Number(scene.id) === Number(sceneId); });
  }

  function layoutLabel(layoutId) {
    return editorLayoutNames[layoutId] || String(layoutId || "Current layout").replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function resolvedDefault(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value[editorAspectRatio] !== undefined ? value[editorAspectRatio] : (value.landscape !== undefined ? value.landscape : value.portrait);
    }
    return value;
  }

  function appendPropertyFields(container, scene) {
    var descriptor = sceneDescriptor(scene);
    var props = descriptor.layoutProps && typeof descriptor.layoutProps === "object" ? descriptor.layoutProps : {};
    var layoutId = sceneLayoutId(scene);
    var baseLayout = String(layoutId || "").replace(/__v\d+$/i, "");
    var schema = editorLayoutSchema[layoutId] || editorLayoutSchema[baseLayout] || {};
    var fields = Array.isArray(schema.fields) ? schema.fields : [];
    var defaults = schema.defaults || {};
    var heading = document.createElement("div");
    heading.className = "b2v-scene-props-heading";
    heading.innerHTML = "<strong>Layout properties</strong><span>Values currently saved for this scene.</span>";
    container.appendChild(heading);
    if (!fields.length) {
      var empty = document.createElement("p");
      empty.className = "b2v-scene-props-empty";
      empty.textContent = "This layout has no additional editable properties.";
      container.appendChild(empty);
      return;
    }
    var grid = document.createElement("div");
    grid.className = "b2v-scene-props-grid";
    fields.forEach(function (field) {
      if (!field || !field.key) return;
      var label = document.createElement("label");
      var caption = document.createElement("span");
      caption.textContent = field.label || String(field.key).replace(/_/g, " ");
      label.appendChild(caption);
      var value = props[field.key] !== undefined ? props[field.key] : resolvedDefault(defaults[field.key]);
      var control;
      var controlWrap = null;
      if (field.type === "select" && Array.isArray(field.options)) {
        control = document.createElement("select");
        field.options.forEach(function (entry) {
          var option = document.createElement("option");
          option.value = typeof entry === "object" ? entry.value : entry;
          option.textContent = typeof entry === "object" ? (entry.label || entry.value) : entry;
          control.appendChild(option);
        });
        control.value = value == null ? "" : String(value);
      } else if (["number", "range"].includes(field.type)) {
        control = document.createElement("input");
        control.type = "number";
        var isFontSize = /font.*size|size.*font/i.test(String(field.key));
        var minimum = field.min !== undefined ? field.min : (isFontSize ? 8 : undefined);
        var maximum = field.max !== undefined ? field.max : (isFontSize ? 180 : undefined);
        if (minimum !== undefined) control.min = minimum;
        if (maximum !== undefined) control.max = maximum;
        control.step = field.step || 1;
        control.value = value == null ? "" : value;
        if (isFontSize || field.type === "range") {
          controlWrap = document.createElement("div");
          controlWrap.className = "b2v-range-control";
          var slider = document.createElement("input");
          slider.type = "range";
          slider.min = minimum !== undefined ? minimum : 0;
          slider.max = maximum !== undefined ? maximum : 200;
          slider.step = field.step || 1;
          slider.value = value == null || value === "" ? slider.min : value;
          slider.setAttribute("aria-label", caption.textContent + " slider");
          slider.addEventListener("input", function () { control.value = slider.value; });
          control.addEventListener("input", function () { if (control.value !== "") slider.value = control.value; });
          controlWrap.append(slider, control);
        }
      } else if (field.type === "color") {
        control = document.createElement("input");
        control.type = "color";
        control.value = /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#7c3aed";
      } else if (field.type === "boolean") {
        control = document.createElement("input");
        control.type = "checkbox";
        control.checked = Boolean(value);
        label.className = "b2v-prop-checkbox";
      } else if (["string_array", "object_array", "chart_table", "ohlcv_table", "pipe_table", "ticker_table"].includes(field.type)) {
        control = document.createElement("textarea");
        control.rows = 4;
        control.value = value == null ? "" : JSON.stringify(value, null, 2);
        control.dataset.json = "true";
        label.className = "b2v-prop-wide";
      } else if (field.type === "text") {
        control = document.createElement("textarea");
        control.rows = 3;
        control.value = value == null ? "" : String(value);
        label.className = "b2v-prop-wide";
      } else {
        control = document.createElement("input");
        control.type = "text";
        control.value = value == null ? "" : String(value);
      }
      control.dataset.propKey = field.key;
      control.dataset.propType = field.type || "string";
      label.appendChild(controlWrap || control);
      grid.appendChild(label);
    });
    container.appendChild(grid);
  }

  function buildSceneForm(scene, index) {
    var form = document.createElement("form");
    form.className = "b2v-scene-form";
    form.dataset.sceneId = scene.id;
    form.innerHTML = '<div class="b2v-scene-form-grid b2v-scene-copy-grid">' +
      '<label><span>Scene title</span><input type="text" data-field="title" maxlength="255"></label>' +
      '<label><span>Duration (seconds)</span><input type="number" data-field="duration" min="1" max="120" step="0.1"></label>' +
      '<label class="b2v-field-wide"><span>On-screen text</span><textarea data-field="display" rows="3"></textarea></label>' +
      '<label class="b2v-field-wide"><span>Narration</span><textarea data-field="narration" rows="5" readonly></textarea></label>' +
      '<label class="b2v-field-wide"><span>Visual direction</span><textarea data-field="visual" rows="3" readonly></textarea></label>' +
      '<label><span>Layout</span><select data-field="layout"></select><small>Applied when you regenerate this scene.</small></label>' +
      '<label class="b2v-regenerate-voice"><input type="checkbox" data-field="regenerate-voice"><span>Regenerate this scene’s voiceover</span></label>' +
      '</div><div class="b2v-scene-media"><div class="b2v-scene-props-heading"><strong>Scene visual</strong><span>Add, replace or remove this scene’s image.</span></div></div><div class="b2v-scene-props"></div>' +
      '<div class="b2v-scene-form-actions"><button type="submit" class="button button-primary" data-action="save">Save scene</button><button type="button" class="button" data-action="regenerate">Regenerate scene</button><button type="button" class="button" data-action="up">Move up</button><button type="button" class="button" data-action="down">Move down</button><button type="button" class="button button-link-delete" data-action="delete">Delete</button></div>';
    form.querySelector('[data-field="title"]').value = scene.title || "";
    form.querySelector('[data-field="duration"]').value = Number(scene.duration_seconds || 10);
    form.querySelector('[data-field="display"]').value = scene.display_text || "";
    form.querySelector('[data-field="narration"]').value = scene.narration_text || "";
    form.querySelector('[data-field="visual"]').value = scene.visual_description || "";
    var layout = form.querySelector('[data-field="layout"]');
    var keep = document.createElement("option");
    keep.value = "";
    keep.textContent = "Keep current — " + layoutLabel(sceneLayoutId(scene));
    layout.appendChild(keep);
    editorLayouts.forEach(function (layoutId) {
      var option = document.createElement("option");
      option.value = layoutId;
      option.textContent = layoutLabel(layoutId);
      layout.appendChild(option);
    });
    form.querySelector('[data-action="up"]').disabled = index === 0;
    form.querySelector('[data-action="down"]').disabled = index === editorScenes.length - 1;
    appendSceneMedia(form.querySelector(".b2v-scene-media"), scene);
    appendPropertyFields(form.querySelector(".b2v-scene-props"), scene);
    return form;
  }

  function renderSceneGroups(preferredSceneId) {
    activeSceneId = preferredSceneId ? Number(preferredSceneId) : activeSceneId;
    editorScenes.sort(function (a, b) { return Number(a.order) - Number(b.order); });
    sceneGroups.textContent = "";
    sceneCount.textContent = editorScenes.length + (editorScenes.length === 1 ? " scene" : " scenes");
    for (var start = 0; start < editorScenes.length; start += 5) {
      var scenes = editorScenes.slice(start, start + 5);
      var group = document.createElement("details");
      group.className = "b2v-scene-group";
      var includesPreferred = scenes.some(function (scene) { return Number(scene.id) === Number(activeSceneId); });
      group.open = start === 0 || includesPreferred;
      var groupSummary = document.createElement("summary");
      groupSummary.innerHTML = '<span><strong></strong><small></small></span><span class="b2v-accordion-chevron">⌄</span>';
      groupSummary.querySelector("strong").textContent = "Scenes " + (start + 1) + "–" + (start + scenes.length);
      groupSummary.querySelector("small").textContent = scenes.length + " editable scenes";
      group.appendChild(groupSummary);
      var groupBody = document.createElement("div");
      groupBody.className = "b2v-scene-group-body";
      scenes.forEach(function (scene, localIndex) {
        var index = start + localIndex;
        var item = document.createElement("details");
        item.className = "b2v-scene-accordion";
        item.dataset.sceneId = scene.id;
        item.open = Number(scene.id) === Number(activeSceneId) || (!activeSceneId && index === 0);
        var summary = document.createElement("summary");
        summary.innerHTML = '<span class="b2v-scene-index"></span><span class="b2v-scene-summary-copy"><strong></strong><small></small></span><span class="b2v-accordion-chevron">⌄</span>';
        summary.querySelector(".b2v-scene-index").textContent = index + 1;
        summary.querySelector("strong").textContent = text(scene.title, "Untitled scene");
        summary.querySelector("small").textContent = layoutLabel(sceneLayoutId(scene)) + " · " + Number(scene.duration_seconds || 0).toFixed(1) + "s";
        item.append(summary, buildSceneForm(scene, index));
        item.addEventListener("toggle", function () { if (item.open) activeSceneId = Number(scene.id); });
        groupBody.appendChild(item);
      });
      group.appendChild(groupBody);
      sceneGroups.appendChild(group);
    }
    if (!editorScenes.length) {
      var empty = document.createElement("div");
      empty.className = "b2v-scenes-empty";
      empty.textContent = "No generated scenes were found. Add a scene or generate the video draft again.";
      sceneGroups.appendChild(empty);
    }
    if (activeSceneId) {
      var active = sceneGroups.querySelector('[data-scene-id="' + activeSceneId + '"]');
      if (active) setTimeout(function () { active.scrollIntoView({ block: "nearest" }); }, 0);
    }
  }

  function scriptEditorMessage(value, error) {
    scriptMessage.textContent = value || "";
    scriptMessage.classList.toggle("is-error", Boolean(error));
  }

  function narrationWordStats(value) {
    var trimmed = (value || "").trim();
    var words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { words: words, seconds: Math.max(1, Math.round(words / 2.5)) };
  }

  function creditsLabel() {
    if (aiCreditsAvailable == null) return "";
    return aiCreditsAvailable >= 5000 ? "5000+" : String(aiCreditsAvailable);
  }

  function buildScriptForm(scene) {
    var form = document.createElement("form");
    form.className = "b2v-script-form";
    form.dataset.sceneId = scene.id;
    var narrationChanged = false;
    form.innerHTML =
      '<div class="b2v-script-credits"><span data-script-credits></span></div>' +
      '<div class="b2v-script-upgrade" data-script-upgrade hidden>' +
      '<p class="b2v-script-upgrade-title">You’ve used all your AI edit credits.</p>' +
      '<p class="b2v-script-upgrade-copy">AI rewrite and voiceover re-record are unavailable. You can still edit the narration text directly.</p>' +
      '<a class="button button-primary" data-script-upgrade-link href="#" target="_blank" rel="noopener">View plans</a>' +
      '</div>' +
      '<div data-script-ai-panel>' +
      '<div class="b2v-narration-block">' +
      '<div class="b2v-narration-head"><strong>Scene narration</strong><span data-narration-meta class="b2v-narration-meta"></span></div>' +
      '<p class="b2v-narration-hint" data-narration-hint>This is what’s spoken in the voiceover and shown on screen. Edit it directly, or use AI below.</p>' +
      '<textarea class="b2v-narration-textarea" data-script-field="narration" rows="5"></textarea>' +
      '</div>' +
      '<div class="b2v-narration-ai">' +
      '<button type="button" class="b2v-narration-ai-toggle" data-narration-ai-toggle>✦ Rewrite this with AI</button>' +
      '<div class="b2v-narration-ai-box" data-narration-ai-box hidden>' +
      '<label><span>What should AI change?</span><textarea data-script-field="ai-instruction" rows="3" placeholder="Describe how this scene should change…"></textarea></label>' +
      '</div>' +
      '</div>' +
      '<div class="b2v-narration-save-card">' +
      '<div class="b2v-narration-save-heading">When you save</div>' +
      '<div class="b2v-narration-save-row">' +
      '<div><strong>Re-record the voiceover</strong><p>Generate fresh audio for the new narration. Turn off to keep the current audio.</p></div>' +
      '<label class="b2v-toggle-switch"><input type="checkbox" data-script-field="regenerate-voice"><span></span></label>' +
      '</div>' +
      '<div class="b2v-narration-exact-row" data-narration-exact-row hidden>' +
      '<span>Speak word-for-word (On) or let AI rephrase it (Off).</span>' +
      '<label class="b2v-toggle-switch"><input type="checkbox" data-script-field="exact-wording" checked><span></span></label>' +
      '</div>' +
      '<p class="b2v-narration-afford-warning" data-narration-afford-warning hidden></p>' +
      '<p class="b2v-narration-status" data-narration-status></p>' +
      '<p class="b2v-narration-voice-note">You can change the voiceover type from project Settings</p>' +
      '</div>' +
      '</div>' +
      '<div class="b2v-script-form-actions"><button type="submit" class="button button-primary" data-script-save>Save script changes</button><button type="button" class="button" data-open-scene="' + scene.id + '">Open full scene settings</button></div>';
    var narrationField = form.querySelector('[data-script-field="narration"]');
    narrationField.value = scene.narration_text || "";
    var regenerateVoiceField = form.querySelector('[data-script-field="regenerate-voice"]');
    var exactWordingRow = form.querySelector('[data-narration-exact-row]');
    var statusEl = form.querySelector('[data-narration-status]');
    var affordWarningEl = form.querySelector('[data-narration-afford-warning]');
    var metaEl = form.querySelector('[data-narration-meta]');
    var creditsEl = form.querySelector('[data-script-credits]');
    var upgradeEl = form.querySelector('[data-script-upgrade]');
    var upgradeLink = form.querySelector('[data-script-upgrade-link]');
    var saveButton = form.querySelector('[data-script-save]');
    var aiToggle = form.querySelector('[data-narration-ai-toggle]');
    var aiBox = form.querySelector('[data-narration-ai-box]');
    var aiInstruction = form.querySelector('[data-script-field="ai-instruction"]');
    var hintEl = form.querySelector('[data-narration-hint]');
    upgradeLink.href = (B2VAdmin.appUrl || "https://blog2video.app") + "/pricing";

    function updateMeta() {
      var stats = narrationWordStats(narrationField.value);
      metaEl.textContent = stats.words + (stats.words === 1 ? " word" : " words") + " · ~" + stats.seconds + "s";
    }

    function updateStatus() {
      var upToDate = !regenerateVoiceField.checked && narrationField.value.trim() === (scene.narration_text || "").trim();
      statusEl.textContent = upToDate ? "Voiceover is up to date — no new audio needed" : "New voiceover will be generated on save";
      statusEl.classList.toggle("is-ready", upToDate);
      statusEl.classList.toggle("is-pending", !upToDate);
      narrationChanged = narrationField.value.trim() !== (scene.narration_text || "").trim();
    }

    // A plain narration edit (re-record off) is a free PUT — it never costs a
    // credit and must stay editable no matter the balance. Credits only gate
    // the two actions that actually spend them: AI rewrite and voiceover
    // re-record. canUseAI (any credit left) disables just those two controls;
    // canAffordThisEdit (enough for THIS edit's current cost) disables Save
    // only while one of those paid actions is actually selected.
    function updateCredits() {
      var wantsPaidAction = Boolean(aiInstruction.value.trim()) || regenerateVoiceField.checked;
      var cost = regenerateVoiceField.checked ? VOICEOVER_EDIT_CREDIT_COST : 1;
      var hasBalance = aiCreditsAvailable != null;
      var canUseAI = !hasBalance || aiCreditsAvailable >= 1;
      var canAffordThisEdit = !hasBalance || aiCreditsAvailable >= cost;
      var label = creditsLabel();
      creditsEl.hidden = !canUseAI;
      creditsEl.textContent = canUseAI && label
        ? "AI edits remaining: " + label + " (voiceover regen costs " + VOICEOVER_EDIT_CREDIT_COST + " AI edit credits.)"
        : "";
      upgradeEl.hidden = canUseAI;
      aiToggle.disabled = !canUseAI;
      aiToggle.classList.toggle("is-locked", !canUseAI);
      regenerateVoiceField.disabled = !canUseAI;
      if (!canUseAI && regenerateVoiceField.checked) {
        regenerateVoiceField.checked = false;
        exactWordingRow.hidden = true;
        wantsPaidAction = Boolean(aiInstruction.value.trim());
        updateStatus();
      }
      var hasChanges = wantsPaidAction || narrationField.value.trim() !== (scene.narration_text || "").trim();
      saveButton.disabled = !hasChanges || (wantsPaidAction && (!canUseAI || !canAffordThisEdit));
      affordWarningEl.hidden = !(canUseAI && wantsPaidAction && !canAffordThisEdit);
      if (canUseAI && wantsPaidAction && !canAffordThisEdit) {
        affordWarningEl.textContent = "You have " + aiCreditsAvailable + " AI edit credit" + (aiCreditsAvailable === 1 ? "" : "s") +
          " left — this edit costs " + cost + ". Turn off re-record to bring the cost down, or upgrade for more.";
      }
    }

    narrationField.addEventListener("input", function () {
      if (narrationField.value.trim() !== (scene.narration_text || "").trim()) {
        regenerateVoiceField.checked = true;
      }
      updateMeta();
      updateStatus();
      exactWordingRow.hidden = !regenerateVoiceField.checked;
      updateCredits();
    });
    regenerateVoiceField.addEventListener("change", function () {
      exactWordingRow.hidden = !regenerateVoiceField.checked;
      updateStatus();
      updateCredits();
    });
    aiInstruction.addEventListener("input", function () {
      if (aiInstruction.value.trim()) {
        regenerateVoiceField.checked = true;
        exactWordingRow.hidden = false;
      }
      updateStatus();
      updateCredits();
    });
    aiToggle.addEventListener("click", function () {
      if (aiToggle.disabled) return;
      var showing = aiBox.hidden;
      aiBox.hidden = !showing;
      narrationField.readOnly = showing;
      hintEl.textContent = showing
        ? "AI will rewrite this for you — finish your instruction below. Close “Rewrite with AI” to edit it by hand."
        : "This is what’s spoken in the voiceover and shown on screen. Edit it directly, or use AI below.";
      aiToggle.textContent = showing ? "Tell AI what to change" : "✦ Rewrite this with AI";
      aiToggle.classList.toggle("is-active", showing);
    });

    updateMeta();
    updateStatus();
    updateCredits();
    exactWordingRow.hidden = !regenerateVoiceField.checked;
    loadAccount().then(updateCredits).catch(function () {});
    return form;
  }

  function renderScriptGroups() {
    scriptGroups.textContent = "";
    var totalDuration = editorScenes.reduce(function (total, scene) { return total + Number(scene.duration_seconds || 0); }, 0);
    scriptSummary.textContent = editorScenes.length + (editorScenes.length === 1 ? " scene" : " scenes") + " · " + Math.round(totalDuration) + " seconds · edit the words viewers see and hear";
    for (var start = 0; start < editorScenes.length; start += 5) {
      var scenes = editorScenes.slice(start, start + 5);
      var group = document.createElement("details");
      group.className = "b2v-script-group";
      group.open = start === 0;
      var summary = document.createElement("summary");
      summary.innerHTML = '<span><strong></strong><small></small></span><span class="b2v-accordion-chevron">⌄</span>';
      summary.querySelector("strong").textContent = "Script scenes " + (start + 1) + "–" + (start + scenes.length);
      summary.querySelector("small").textContent = scenes.length + " scenes · click to expand";
      group.appendChild(summary);
      var body = document.createElement("div");
      body.className = "b2v-script-group-body";
      scenes.forEach(function (scene, localIndex) {
        var item = document.createElement("details");
        item.className = "b2v-script-scene";
        item.open = start === 0 && localIndex === 0;
        var itemSummary = document.createElement("summary");
        itemSummary.innerHTML = '<span class="b2v-scene-index"></span><span class="b2v-scene-summary-copy"><strong></strong><small></small></span><span class="b2v-accordion-chevron">⌄</span>';
        itemSummary.querySelector(".b2v-scene-index").textContent = start + localIndex + 1;
        itemSummary.querySelector("strong").textContent = text(scene.title, "Untitled scene");
        itemSummary.querySelector("small").textContent = text(scene.display_text, "No on-screen text");
        item.append(itemSummary, buildScriptForm(scene));
        body.appendChild(item);
      });
      group.appendChild(body);
      scriptGroups.appendChild(group);
    }
  }

  function loadNativeEditor(preferredSceneId) {
    editorLoading.hidden = false;
    sceneGroups.hidden = true;
    return Promise.all([
      wp.apiFetch({ path: base + "/editor" }),
      wp.apiFetch({ path: base + "/layouts" })
    ]).then(function (results) {
      editorScenes = (results[0].scenes || []).slice();
      editorAssets = (results[0].assets || []).slice();
      editorAspectRatio = results[0].aspect_ratio || "landscape";
      editorLayouts = results[1].selectable_layouts || results[1].layouts || [];
      editorLayoutNames = results[1].layout_names || {};
      editorLayoutSchema = results[1].layout_prop_schema || {};
      editorLoading.hidden = true;
      sceneGroups.hidden = false;
      renderSceneGroups(preferredSceneId || activeSceneId || (editorScenes[0] && editorScenes[0].id));
      renderScriptGroups();
    }).catch(function (error) {
      editorLoading.hidden = true;
      nativeEditorMessage(errorText(error), true);
      sceneGroups.hidden = false;
    });
  }

  function openEditor() {
    if (!Number(B2VAdmin.projectId)) {
      message("Generate a video draft before opening the editor.", true);
      return;
    }
    editorModal.hidden = false;
    document.body.classList.add("b2v-editor-open");
    loadNativeEditor();
  }

  function closeEditor() {
    clearTimeout(scriptPollTimer);
    editorModal.hidden = true;
    document.body.classList.remove("b2v-editor-open");
    message("Checking your latest video changes…", false, true);
    pollGeneration();
  }
  function showEmbedPrompt() {
    clearTimeout(timer);
    setProgress(null);
    render.hidden = true;
    setButtonBusy(render, false);
    setEmbedReady(true);
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
    return Boolean(error && error.code === "b2v_video_limit");
  }

  function toggleUpgradeSlot(error) {
    var slot = document.getElementById("b2v-upgrade-slot");
    var link = document.getElementById("b2v-upgrade-link");
    if (!slot || !link) return;
    if (!isLimitError(error)) {
      slot.hidden = true;
      return;
    }
    link.href = (B2VAdmin.appUrl || "https://blog2video.app") + "/pricing";
    slot.hidden = false;
  }

  function showUpgradePrompt(error) {
    message(errorText(error), true);
    toggleUpgradeSlot(error);
  }

  function closeProjectLibrary() {
    projectModal.hidden = true;
    document.body.classList.remove("b2v-project-open");
  }

  function projectMatches(project) {
    var query = projectSearch.value.trim().toLowerCase();
    return !query || [project.name, project.id, project.status, project.owner_name].join(" ").toLowerCase().includes(query);
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
      var active = Number(project.id) === Number(B2VAdmin.projectId);
      var card = document.createElement("article");
      card.className = "b2v-project-card" + (active ? " is-active" : "");
      var top = document.createElement("div");
      top.className = "b2v-project-card-top";
      top.innerHTML = '<div class="b2v-project-thumb"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z"></path><path d="m10 9 5 3-5 3z"></path></svg></div><div class="b2v-project-card-copy"><strong></strong><span></span></div>';
      top.querySelector("strong").textContent = project.name || "Untitled project";
      top.querySelector("span").textContent = "Project #" + project.id + " · " + Number(project.scene_count || 0) + " scenes";
      var badges = document.createElement("div");
      badges.className = "b2v-project-badges";
      badges.innerHTML = '<span class="b2v-project-status"></span>' + (project.has_video ? '<span class="is-rendered">Video Ready</span>' : '<span>Draft</span>') + (active ? '<span class="is-active">Currently selected</span>' : '');
      badges.querySelector(".b2v-project-status").textContent = String(project.status || "project").replace(/_/g, " ");
      var actions = document.createElement("div");
      actions.className = "b2v-project-card-actions";
      var replace = document.createElement("button");
      replace.type = "button";
      replace.className = "b2v-project-add";
      var postHasVideo = hasExistingVideo();
      replace.textContent = active
        ? (project.has_video && !postHasVideo ? "Add video" : "Open project")
        : (postHasVideo ? "Replace video" : "Add video");
      replace.addEventListener("click", function () {
        if (!active && hasExistingVideo() && !window.confirm("This post already has a Blog2Video video. Using “" + (project.name || "this project") + "” will replace it. Continue?")) return;
        selectLibraryProject(project, true, replace);
      });
      actions.appendChild(replace);
      card.append(top, badges, actions);
      projectGrid.appendChild(card);
    });
    if (projectLibraryHasMore) {
      var loadMore = document.createElement("button");
      loadMore.type = "button";
      loadMore.className = "button b2v-project-load-more";
      loadMore.id = "b2v-project-load-more";
      loadMore.textContent = "Load more projects";
      loadMore.addEventListener("click", function () { loadProjectLibrary(false, true); });
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
      var current = availableProjects.find(function (project) { return Number(project.id) === Number(B2VAdmin.projectId); });
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

  function loadAccount() {
    if (!accountPromise) {
      accountPromise = wp.apiFetch({ path: base + "/account" }).then(function (data) {
        aiCreditsAvailable = Number(data.ai_edit_credits_available || 0);
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

  function closeLibrary() {
    libraryModal.hidden = true;
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
    templateSelect.value = id;
    selectedTemplate.textContent = text(item.name, id);
    if (modalSelectedTemplate) modalSelectedTemplate.textContent = text(item.name, id);
    closeLibrary();
  }

  function chooseVoice(item) {
    var gender = ["female", "male", "none"].includes(String(item.gender).toLowerCase()) ? String(item.gender).toLowerCase() : "female";
    var accentText = String(item.accent || "american").toLowerCase();
    var accent = accentText.includes("brit") || accentText.includes("england") ? "british" : "american";
    voiceGender.value = gender;
    voiceAccent.value = accent;
    customVoiceId.value = item.voice_id || "";
    var voiceLabel = text(item.name, gender === "none" ? "No voice" : gender + " · " + accent);
    selectedVoice.textContent = voiceLabel;
    if (modalSelectedVoice) modalSelectedVoice.textContent = voiceLabel;
    closeLibrary();
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
    preview.style.background = "linear-gradient(145deg, " + bg + ", " + accent + ")";
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

  function openLibrary(mode) {
    if (mode === "templates" && hasExistingVideo()) {
      if (!window.confirm("This post already has a Blog2Video video. Choosing a new template will replace the existing video with the new one. Continue?")) return;
    }
    libraryMode = mode;
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
      if (data.editor_available || data.project_id) markProjectAvailable(data.project_id);
      if (data.error) {
        setButtonBusy(generate, false);
        return;
      }
      if (data.r2_video_url) {
        if (downloadVideo) {
          downloadVideo.dataset.videoUrl = data.r2_video_url;
          downloadVideo.hidden = false;
        }
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
        render.hidden = false;
        setButtonBusy(render, false);
        message("Draft ready. Edit scenes, adjust settings and regenerate, or continue to Render.");
      }
    }).catch(function (error) { message(errorText(error), true); });
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
    link.setAttribute("download", (B2VAdmin.projectName || "video").replace(/\s+/g, "_") + ".mp4");
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
  function loadLogoState() {
    logoLoaded = false;
    wp.apiFetch({ path: base + "/editor" }).then(function (project) {
      logoLoaded = true;
      renderLogoState(project);
    }).catch(function () { logoLoaded = true; });
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
      if (!window.confirm("Remove this logo from the video?")) return;
      setButtonBusy(logoRemove, true);
      logoMessageText("Removing logo…");
      wp.apiFetch({ path: base + "/logo", method: "DELETE" }).then(function () {
        logoMessageText("Logo removed.");
        renderLogoState({});
      }).catch(function (error) { logoMessageText(errorText(error), true); })
        .finally(function () { setButtonBusy(logoRemove, false); });
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

  function loadProjectSettings() {
    settingsLoaded = false;
    wp.apiFetch({ path: base + "/editor" }).then(function (project) {
      settingsLoaded = true;
      if (colorAccent) colorAccent.value = project.accent_color || "#7C3AED";
      if (colorBg) colorBg.value = project.bg_color || "#FFFFFF";
      if (colorText) colorText.value = project.text_color || "#000000";
      if (fontFamily) fontFamily.value = project.font_family || "";
      if (captionsToggle) captionsToggle.checked = Boolean(project.captions_enabled);
      if (captionFont) captionFont.value = project.caption_font_family || "inter";
      if (captionSize) captionSize.value = project.caption_font_size ? Number(project.caption_font_size) || 36 : 36;
      if (captionOffset) captionOffset.value = typeof project.caption_offset === "number" ? project.caption_offset : 0;
      if (musicTrack) musicTrack.value = project.bgm_track_id || "";
      if (musicVolume) musicVolume.value = project.bgm_volume != null ? project.bgm_volume : 0.1;
      updateMusicPlayState();
    }).catch(function () { settingsLoaded = true; });
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
      loadProjectSettings();
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
    loadLogoState();
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
    if (embedded || Boolean(B2VAdmin.hasEmbed)) return true;
    if (window.wp.data && window.wp.blocks) {
      return Boolean(findVideoBlock(wp.data.select("core/block-editor").getBlocks()));
    }
    return false;
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
        if (existingBlock && dispatch && dispatch.updateBlockAttributes) {
          dispatch.updateBlockAttributes(existingBlock.clientId, { embedUrl: data.preview_url });
          message("“" + (B2VAdmin.projectName || "Video") + "” updated in the existing block. Click Update to publish it.");
          return;
        }
        if (dispatch && dispatch.insertBlocks) {
          dispatch.insertBlocks(wp.blocks.createBlock("blog2video/video", { embedUrl: data.preview_url }));
          message("“" + (B2VAdmin.projectName || "Video") + "” added as a new block. Click Update to publish it.");
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

  generate.addEventListener("click", function () {
    if (sourceType && sourceType.value === "url" && (!sourceUrl.value || !sourceUrl.checkValidity())) {
      sourceUrl.reportValidity();
      message("Enter a valid source URL.", true);
      return;
    }
    setButtonBusy(generate, true);
    setEmbedReady(false);
    message(sourceType && sourceType.value === "url" ? "Reading the supplied article…" : "Reading the current post…", false, true);
    wp.apiFetch({ path: base + "/generate", method: "POST", data: values() }).then(function (data) {
      if (Number(data.project_id) !== Number(B2VAdmin.projectId)) embedded = false;
      markProjectAvailable(data.project_id, data.project_name);
      message("Creating your video draft…", false, true);
      toggleUpgradeSlot(null);
      pollGeneration();
    }).catch(function (error) {
      setButtonBusy(generate, false);
      showUpgradePrompt(error);
    });
  });
  if (sourceType) sourceType.addEventListener("change", updateSourceFields);
  browseTemplates.addEventListener("click", function () { openLibrary("templates"); });
  browseVoices.addEventListener("click", function () { openLibrary("voices"); });
  if (modalBrowseTemplates) modalBrowseTemplates.addEventListener("click", function () { openLibrary("templates"); });
  if (modalBrowseVoices) modalBrowseVoices.addEventListener("click", function () { openLibrary("voices"); });
  libraryModal.querySelectorAll("[data-b2v-close-library]").forEach(function (button) {
    button.addEventListener("click", closeLibrary);
  });
  librarySearch.addEventListener("input", function () {
    libraryEmpty.textContent = "No matching options found.";
    renderPage();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !libraryModal.hidden) closeLibrary();
    if (event.key === "Escape" && !editorModal.hidden) closeEditor();
    if (event.key === "Escape" && !projectModal.hidden) closeProjectLibrary();
    if (event.key === "Escape" && projectSettingsModal && !projectSettingsModal.hidden) closeProjectSettingsModal();
  });
  browseProjects.addEventListener("click", openProjectLibrary);
  projectModal.querySelectorAll("[data-b2v-close-projects]").forEach(function (button) {
    button.addEventListener("click", closeProjectLibrary);
  });
  projectSearch.addEventListener("input", renderProjectLibrary);
  editor.addEventListener("click", openEditor);
  editorModal.querySelectorAll("[data-b2v-close-editor]").forEach(function (button) {
    button.addEventListener("click", closeEditor);
  });
  editorTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var selected = tab.dataset.editorTab;
      editorTabs.forEach(function (item) {
        var active = item.dataset.editorTab === selected;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      });
      editorPanes.forEach(function (pane) {
        var active = pane.dataset.editorPane === selected;
        pane.hidden = !active;
        pane.classList.toggle("is-active", active);
      });
    });
  });

  scriptGroups.addEventListener("submit", function (event) {
    var form = event.target.closest(".b2v-script-form");
    if (!form) return;
    event.preventDefault();
    var scene = sceneById(form.dataset.sceneId);
    var button = form.querySelector('button[type="submit"]');
    if (!scene) return;
    var narrationValue = form.querySelector('[data-script-field="narration"]').value;
    var aiInstruction = form.querySelector('[data-script-field="ai-instruction"]').value.trim();
    var regenerateVoiceover = form.querySelector('[data-script-field="regenerate-voice"]').checked;
    var matchExactly = form.querySelector('[data-script-field="exact-wording"]').checked;
    var narrationChanged = narrationValue.trim() !== (scene.narration_text || "").trim();
    var useRegenerate = Boolean(aiInstruction) || regenerateVoiceover;
    setButtonBusy(button, true);
    scriptEditorMessage("Saving scene " + scene.order + " script…");

    var savePromise;
    if (useRegenerate) {
      savePromise = (narrationChanged
        ? wp.apiFetch({ path: base + "/scenes/" + scene.id, method: "PUT", data: { narration_text: narrationValue } })
        : Promise.resolve()
      ).then(function () {
        return wp.apiFetch({
          path: base + "/scenes/" + scene.id + "/regenerate",
          method: "POST",
          data: {
            description: aiInstruction || undefined,
            narration_text: narrationValue,
            regenerate_voiceover: regenerateVoiceover,
            voiceover_verbatim: matchExactly
          }
        });
      });
    } else {
      savePromise = wp.apiFetch({ path: base + "/scenes/" + scene.id, method: "PUT", data: {
        narration_text: narrationValue
      } });
    }

    savePromise.then(function (updated) {
      if (updated && updated.id) {
        editorScenes = editorScenes.map(function (item) { return Number(item.id) === Number(updated.id) ? updated : item; });
      }
      accountPromise = null;
      loadAccount().catch(function () {});
      return loadNativeEditor(scene.id).then(function () {
        var tab = editorModal.querySelector('[data-editor-tab="script"]');
        if (tab) tab.click();
        scriptEditorMessage("Scene " + scene.order + " script saved.");
      });
    }).catch(function (error) { scriptEditorMessage(errorText(error), true); toggleUpgradeSlot(error); })
      .finally(function () { setButtonBusy(button, false); });
  });

  scriptGroups.addEventListener("click", function (event) {
    var button = event.target.closest("[data-open-scene]");
    if (!button) return;
    activeSceneId = Number(button.dataset.openScene);
    editorModal.querySelector('[data-editor-tab="scenes"]').click();
    renderSceneGroups(activeSceneId);
  });

  function renderScriptReview(previousScenes) {
    scriptReview.textContent = "";
    var heading = document.createElement("div");
    heading.className = "b2v-script-review-head";
    heading.innerHTML = '<div><strong>Review the revised script</strong><span>Compare the previous and revised scene copy before continuing.</span></div><div class="b2v-script-actions"><button type="button" class="button button-primary" data-script-review="approve">Approve and generate scenes</button><button type="button" class="button" data-script-review="retry">Revise again</button></div>';
    scriptReview.appendChild(heading);
    var comparisons = document.createElement("div");
    comparisons.className = "b2v-script-comparisons";
    var count = Math.max(previousScenes.length, editorScenes.length);
    for (var index = 0; index < count; index += 1) {
      var previous = previousScenes[index] || {};
      var revised = editorScenes[index] || {};
      var card = document.createElement("article");
      card.className = "b2v-script-comparison";
      card.innerHTML = '<strong>Scene ' + (index + 1) + '</strong><div><span>Previous</span><p></p></div><div><span>Revised</span><p></p></div>';
      card.querySelectorAll("p")[0].textContent = text(previous.narration_text || previous.display_text, "—");
      card.querySelectorAll("p")[1].textContent = text(revised.narration_text || revised.display_text, "—");
      comparisons.appendChild(card);
    }
    scriptReview.appendChild(comparisons);
    scriptReview.hidden = false;
    scriptRegenerateStart.dataset.mode = "retry";
    scriptRegenerateStart.textContent = "Create another revision";
  }

  function pollScriptRegeneration(afterApproval) {
    clearTimeout(scriptPollTimer);
    wp.apiFetch({ path: base + "/script/status" }).then(function (job) {
      if (!job) throw new Error("The script regeneration job was not found.");
      if (job.status === "awaiting_review") {
        scriptEditorMessage("Revised script ready for your review.");
        return Promise.all([loadNativeEditor(), wp.apiFetch({ path: base + "/script/preview" })]).then(function (values) {
          renderScriptReview(values[1].previous_scenes || []);
        });
      }
      if (job.status === "completed") {
        setButtonBusy(scriptRegenerateStart, false);
        scriptReview.hidden = true;
        scriptRegenerateStart.dataset.mode = "start";
        scriptRegenerateStart.textContent = "Create revised script";
        scriptEditorMessage("Script and scenes updated. Review any scene, then render the video.");
        return loadNativeEditor();
      }
      if (job.status === "failed") {
        setButtonBusy(scriptRegenerateStart, false);
        scriptEditorMessage(job.error_message || "Script regeneration failed.", true);
        return;
      }
      var step = String(job.current_step || "working").replace(/_/g, " ");
      scriptEditorMessage((afterApproval ? "Generating scenes: " : "Revising script: ") + step + "…");
      scriptPollTimer = setTimeout(function () { pollScriptRegeneration(afterApproval); }, 2500);
    }).catch(function (error) {
      setButtonBusy(scriptRegenerateStart, false);
      scriptEditorMessage(errorText(error), true);
    });
  }

  scriptRegenerateToggle.addEventListener("click", function () {
    scriptRegenerate.hidden = !scriptRegenerate.hidden;
    if (!scriptRegenerate.hidden) scriptInstruction.focus();
  });
  scriptRegenerateCancel.addEventListener("click", function () { scriptRegenerate.hidden = true; });
  scriptRegenerateStart.addEventListener("click", function () {
    var instruction = scriptInstruction.value.trim();
    if (!instruction) {
      scriptEditorMessage("Describe how you want the script changed.", true);
      scriptInstruction.focus();
      return;
    }
    setButtonBusy(scriptRegenerateStart, true);
    scriptReview.hidden = true;
    scriptEditorMessage("Starting script regeneration…");
    var endpoint = scriptRegenerateStart.dataset.mode === "retry" ? "/script/retry" : "/script/regenerate";
    wp.apiFetch({ path: base + endpoint, method: "POST", data: { user_instruction: instruction } }).then(function () {
      scriptRegenerate.hidden = true;
      pollScriptRegeneration(false);
    }).catch(function (error) {
      setButtonBusy(scriptRegenerateStart, false);
      scriptEditorMessage(errorText(error), true);
      toggleUpgradeSlot(error);
    });
  });
  scriptReview.addEventListener("click", function (event) {
    var button = event.target.closest("[data-script-review]");
    if (!button) return;
    if (button.dataset.scriptReview === "retry") {
      scriptRegenerate.hidden = false;
      scriptInstruction.focus();
      return;
    }
    setButtonBusy(button, true);
    scriptEditorMessage("Approving script and generating its scenes…");
    wp.apiFetch({ path: base + "/script/verify", method: "POST", data: {} }).then(function () {
      scriptReview.hidden = true;
      pollScriptRegeneration(true);
    }).catch(function (error) { setButtonBusy(button, false); scriptEditorMessage(errorText(error), true); });
  });
  function collectScenePayload(form, scene) {
    var descriptor = sceneDescriptor(scene);
    var props = descriptor.layoutProps && typeof descriptor.layoutProps === "object" ? Object.assign({}, descriptor.layoutProps) : {};
    form.querySelectorAll("[data-prop-key]").forEach(function (control) {
      var key = control.dataset.propKey;
      if (control.dataset.json === "true") {
        if (!control.value.trim()) delete props[key];
        else props[key] = JSON.parse(control.value);
      } else if (control.dataset.propType === "boolean") {
        props[key] = control.checked;
      } else if (["number", "range"].includes(control.dataset.propType)) {
        if (control.value === "") delete props[key];
        else props[key] = Number(control.value);
      } else {
        props[key] = control.value;
      }
    });
    descriptor.layoutProps = props;
    return {
      title: form.querySelector('[data-field="title"]').value,
      display_text: form.querySelector('[data-field="display"]').value,
      duration_seconds: Number(form.querySelector('[data-field="duration"]').value || 10),
      remotion_code: JSON.stringify(descriptor)
    };
  }

  sceneGroups.addEventListener("submit", function (event) {
    var form = event.target.closest(".b2v-scene-form");
    if (!form) return;
    event.preventDefault();
    var scene = sceneById(form.dataset.sceneId);
    var button = form.querySelector('[data-action="save"]');
    if (!scene) return;
    var payload;
    try {
      payload = collectScenePayload(form, scene);
    } catch (error) {
      nativeEditorMessage("One of the structured scene properties is not valid JSON.", true);
      return;
    }
    setButtonBusy(button, true);
    nativeEditorMessage("Saving scene " + scene.order + "…");
    wp.apiFetch({ path: base + "/scenes/" + scene.id, method: "PUT", data: payload }).then(function (updated) {
      editorScenes = editorScenes.map(function (item) { return item.id === updated.id ? updated : item; });
      renderSceneGroups(updated.id);
      nativeEditorMessage("Scene " + updated.order + " saved. Render the video when you finish editing.");
    }).catch(function (error) { nativeEditorMessage(errorText(error), true); })
      .finally(function () { setButtonBusy(button, false); });
  });

  function moveScene(sceneId, offset) {
    var scene = sceneById(sceneId);
    var index = editorScenes.indexOf(scene);
    var target = index + offset;
    if (!scene || target < 0 || target >= editorScenes.length) return;
    var moved = editorScenes.splice(index, 1)[0];
    editorScenes.splice(target, 0, moved);
    var orders = editorScenes.map(function (item, itemIndex) { return { scene_id: item.id, order: itemIndex + 1 }; });
    wp.apiFetch({ path: base + "/scenes/reorder", method: "POST", data: { scene_orders: orders } }).then(function (scenes) {
      editorScenes = scenes;
      renderSceneGroups(scene.id);
      nativeEditorMessage("Scene order updated.");
    }).catch(function (error) { nativeEditorMessage(errorText(error), true); loadNativeEditor(scene.id); });
  }

  sceneGroups.addEventListener("click", function (event) {
    var button = event.target.closest("[data-action]");
    if (!button || button.dataset.action === "save") return;
    var form = button.closest(".b2v-scene-form");
    var scene = form && sceneById(form.dataset.sceneId);
    if (!scene) return;
    activeSceneId = Number(scene.id);
    if (button.dataset.action === "choose-image") {
      form.querySelector("[data-scene-image-input]").click();
      return;
    }
    if (button.dataset.action === "remove-image") {
      if (!window.confirm("Remove this image from scene " + scene.order + "? The original file remains available in the project.")) return;
      var descriptor = sceneDescriptor(scene);
      var imageProps = descriptor.layoutProps && typeof descriptor.layoutProps === "object" ? Object.assign({}, descriptor.layoutProps) : {};
      imageProps.hideImage = true;
      delete imageProps.assignedImage;
      delete imageProps.assignedVideo;
      delete imageProps.imageFocusX;
      delete imageProps.imageFocusY;
      delete imageProps.imageZoom;
      descriptor.layoutProps = imageProps;
      setButtonBusy(button, true);
      nativeEditorMessage("Removing the image from scene " + scene.order + "…");
      wp.apiFetch({ path: base + "/scenes/" + scene.id, method: "PUT", data: { remotion_code: JSON.stringify(descriptor) } }).then(function () {
        nativeEditorMessage("Image removed from scene " + scene.order + ".");
        return loadNativeEditor(scene.id);
      }).catch(function (error) { nativeEditorMessage(errorText(error), true); })
        .finally(function () { setButtonBusy(button, false); });
      return;
    }
    if (button.dataset.action === "up" || button.dataset.action === "down") {
      moveScene(scene.id, button.dataset.action === "up" ? -1 : 1);
      return;
    }
    if (button.dataset.action === "delete") {
      if (!window.confirm("Delete scene " + scene.order + " from the video?")) return;
      setButtonBusy(button, true);
      wp.apiFetch({ path: base + "/scenes/" + scene.id, method: "DELETE" }).then(function () {
        editorScenes = editorScenes.filter(function (item) { return item.id !== scene.id; });
        activeSceneId = editorScenes.length ? editorScenes[Math.min(editorScenes.length - 1, Math.max(0, Number(scene.order) - 2))].id : null;
        renderSceneGroups(activeSceneId);
        nativeEditorMessage("Scene deleted.");
      }).catch(function (error) { nativeEditorMessage(errorText(error), true); })
        .finally(function () { setButtonBusy(button, false); });
      return;
    }
    if (button.dataset.action === "regenerate") {
      setButtonBusy(button, true);
      nativeEditorMessage("Regenerating scene " + scene.order + "…");
      wp.apiFetch({
        path: base + "/scenes/" + scene.id + "/regenerate",
        method: "POST",
        data: {
          layout: form.querySelector('[data-field="layout"]').value || null,
          regenerate_voiceover: form.querySelector('[data-field="regenerate-voice"]').checked
        }
      }).then(function () {
        nativeEditorMessage("Scene regenerated successfully.");
        return loadNativeEditor(scene.id);
      }).catch(function (error) { nativeEditorMessage(errorText(error), true); toggleUpgradeSlot(error); })
        .finally(function () { setButtonBusy(button, false); });
    }
  });
  sceneGroups.addEventListener("change", function (event) {
    var input = event.target.closest("[data-scene-image-input]");
    if (!input || !input.files || !input.files[0]) return;
    var form = input.closest(".b2v-scene-form");
    var scene = form && sceneById(form.dataset.sceneId);
    var file = input.files[0];
    if (!scene) return;
    if (file.size > 5 * 1024 * 1024) {
      nativeEditorMessage("Image file too large. Maximum size is 5 MB.", true);
      input.value = "";
      return;
    }
    var choose = form.querySelector('[data-action="choose-image"]');
    var data = new FormData();
    data.append("image", file, file.name);
    setButtonBusy(choose, true);
    nativeEditorMessage("Uploading image for scene " + scene.order + "…");
    wp.apiFetch({ path: base + "/scenes/" + scene.id + "/image", method: "POST", body: data }).then(function () {
      nativeEditorMessage("Scene " + scene.order + " image updated. Render the video when you finish editing.");
      return loadNativeEditor(scene.id);
    }).catch(function (error) { nativeEditorMessage(errorText(error), true); })
      .finally(function () { setButtonBusy(choose, false); input.value = ""; });
  });
  addSceneButton.addEventListener("click", function () {
    var prompt = window.prompt("Describe the new scene you want to add:");
    if (!prompt || !prompt.trim()) return;
    setButtonBusy(addSceneButton, true);
    nativeEditorMessage("Creating the new scene…");
    wp.apiFetch({ path: base + "/scenes/add", method: "POST", data: { prompt: prompt.trim(), position: editorScenes.length + 1 } }).then(function () {
      var pollAdd = function () {
        wp.apiFetch({ path: base + "/scenes/add-status" }).then(function (job) {
          if (job && job.status === "completed") {
            setButtonBusy(addSceneButton, false);
            loadNativeEditor(job.new_scene_id);
          } else if (job && job.status === "failed") {
            setButtonBusy(addSceneButton, false);
            nativeEditorMessage(job.error_message || "Could not add the scene.", true);
          } else {
            setTimeout(pollAdd, 2500);
          }
        }).catch(function (error) { setButtonBusy(addSceneButton, false); nativeEditorMessage(errorText(error), true); });
      };
      pollAdd();
    }).catch(function (error) { setButtonBusy(addSceneButton, false); nativeEditorMessage(errorText(error), true); toggleUpgradeSlot(error); });
  });
  applyInitialProjectState();
  updateSourceFields();
  if (Number(B2VAdmin.projectId)) {
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
  if (status.textContent.trim()) pollGeneration();
};
