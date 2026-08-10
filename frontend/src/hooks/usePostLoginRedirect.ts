import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * The post-sign-in destination chain, shared by every landing page.
 *
 * Both Landing (blog2video) and PdfLanding (pdf2video) sign users in with the
 * same Google button, so the "where do they land" decision lives here rather
 * than being duplicated per page — otherwise the two copies drift and one brand
 * silently stops honouring, say, pending invites.
 *
 * Priority: pending template download → pending MCP connector → pending
 * collaboration invite → dashboard.
 */
export function usePostLoginRedirect() {
  const navigate = useNavigate();

  return useCallback(async () => {
    const pendingDownload = localStorage.getItem("b2v_pending_template_download");
    if (pendingDownload) {
      localStorage.removeItem("b2v_pending_template_download");
      let slug: string;
      try {
        slug = JSON.parse(pendingDownload);
      } catch {
        slug = "";
      }
      if (slug) {
        const { triggerTemplateDownload } = await import("../pages/FreeTemplatesPage");
        void triggerTemplateDownload(slug);
        navigate(`/tools/free-remotion-templates?downloaded=${encodeURIComponent(slug)}`);
        return;
      }
    }

    if (localStorage.getItem("b2v_pending_mcp")) {
      localStorage.removeItem("b2v_pending_mcp");
      navigate("/mcp-connector");
      return;
    }

    // Resume a collaboration invite the user opened before signing in.
    const pendingInvite = localStorage.getItem("b2v_pending_invite");
    if (pendingInvite) {
      localStorage.removeItem("b2v_pending_invite");
      navigate(`/invite/${pendingInvite}`, { replace: true });
      return;
    }

    navigate("/dashboard");
  }, [navigate]);
}
