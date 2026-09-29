(function (blocks, element, components, blockEditor) {
  "use strict";
  var el = element.createElement;
  blocks.registerBlockType("blog2video/video", {
    apiVersion: 2,
    title: "Blog2Video",
    icon: "format-video",
    category: "embed",
    description: "Embed any Blog2Video project. Add multiple blocks to use multiple videos in one post.",
    attributes: {
      embedUrl: { type: "string", default: "" },
      projectId: { type: "integer", default: 0 },
      projectName: { type: "string", default: "" },
      aspectRatio: { type: "string", default: "16:9" }
    },
    edit: function (props) {
      var url = props.attributes.embedUrl;
      return el("div", blockEditor.useBlockProps({ className: "b2v-editor-block" }),
        el(components.TextControl, {
          label: "Blog2Video embed URL",
          value: url,
          help: "Generate and render from the Blog2Video panel, or paste a Blog2Video preview URL.",
          onChange: function (value) { props.setAttributes({ embedUrl: value }); }
        }),
        url ? el("div", { style: { position: "relative", paddingTop: "56.25%" } },
          el("iframe", { src: url, title: "Blog2Video preview", style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 } })
        ) : el(components.Placeholder, { icon: "format-video", label: "Blog2Video" }, "No video linked yet.")
      );
    },
    save: function () { return null; }
  });
}(window.wp.blocks, window.wp.element, window.wp.components, window.wp.blockEditor));
