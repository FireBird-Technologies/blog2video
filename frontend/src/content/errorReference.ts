import type { SupportDoc } from "./supportTypes";

export const errorReference: SupportDoc = {
  id: "support:error-reference",
  title: "Blog2Video Error Messages — What They Mean and How to Fix Them",
  description:
    "A complete reference of every error message shown in Blog2Video, with plain-English explanations and steps to resolve each one.",
  primaryKeyword: "blog2video error messages",
  keywordVariant: "blog2video error fix troubleshoot",
  route: "/help/errors",
  relatedPaths: ["/dashboard", "/projects", "/help"],
  headings: [
    "Video generation errors",
    "Render errors",
    "Scene editing errors",
    "AI editing errors",
    "Image errors",
    "File upload errors",
    "Voice and audio errors",
    "Template errors",
    "Download and export errors",
    "Embed and share errors",
    "Authentication and checkout errors",
    "Account errors",
    "Generic errors",
  ],
  faq_questions: [
    "Why does it say something went wrong while creating my video?",
    "Why does render fail after multiple attempts?",
    "What does video limit reached mean?",
    "Why does it say AI editing limit reached?",
    "Why does it say failed to update scene?",
    "Why does image generation fail?",
    "What file types can I upload?",
    "Why does it say logo must be under 2 MB?",
    "Why does it say failed to create voice clone?",
    "Why can't I remove the last voice?",
    "Why does it say custom template has been deleted?",
    "Why does it say video URL not found?",
    "What does checkout failed mean?",
    "Why is my account locked after failed password attempts?",
  ],
  body: `
Blog2Video Error Messages — Complete Reference

== VIDEO GENERATION ERRORS ==

Error: "Something went wrong while creating your video. Please try again."
Why it happens: The AI pipeline failed while extracting your content, generating scenes, or writing narration. This can happen due to a temporary server issue, an unreachable URL, or unusually complex source content.
What to do: Wait a few seconds and try again. If the URL is behind a paywall or login, paste the article text directly instead. If the problem persists, contact support.

Error: "Failed to start generation. Please try again or contact support if the issue persists."
Why it happens: The server could not queue the generation job. This is usually a temporary server-side issue.
What to do: Refresh the page and try again. If it fails repeatedly, contact support with your project URL.

Error: "Failed to upload documents."
Why it happens: The file you uploaded could not be read or transferred to the server during the generation step.
What to do: Check that your file is under 5 MB, is a supported format (PDF, DOCX, PPTX, MD, TXT, VTT), and try uploading again.

== RENDER ERRORS ==

Error: "Render failed after multiple attempts. Please try again, or contact support if the issue persists."
Why it happens: The video rendering engine tried to encode your video several times but all attempts failed. This can happen if a scene has corrupt data or a layout that crashes the renderer.
What to do: Try rendering again. If it keeps failing, open each scene and check for unusual characters or empty required fields. If a specific scene causes the issue, editing and saving it may fix the problem.

Error: "Video limit reached. Re-render counts as a video. Upgrade your plan or buy more credits to continue."
Why it happens: You have used all your available video renders for the current period. Re-rendering an existing project counts as a new video.
What to do: Upgrade to a Pro or Standard plan, or buy additional video credits from the pricing page. Free users get 2 videos total.

Error: "You can't render this video because its custom template has been deleted."
Why it happens: The project was created using a custom template that no longer exists in your account. Rendering requires the template to be present.
What to do: Go to Settings in the project and switch to a different template (built-in or another custom template), then try rendering again.

Error: "You can't re-render this video because its custom template has been deleted."
Why it happens: Same as above — the custom template used for this project was deleted after the project was created.
What to do: Switch the template in project Settings and re-render.

Error: "Failed to cancel render."
Why it happens: The request to stop the current render job failed, usually because the render already finished or was already cancelled.
What to do: Refresh the page — the render status should update to reflect the current state.

== SCENE EDITING ERRORS ==

Error: "Failed to update scene."
Why it happens: The save request for your scene edits could not be completed. This is usually a temporary network issue.
What to do: Try saving again. If the error persists, copy your changes, refresh the page, and re-apply them.

Error: "Failed to regenerate scene."
Why it happens: The AI could not regenerate the selected scene. This may be due to an empty description, a server issue, or exhausted AI edit quota on the free plan.
What to do: Make sure your description field is filled in. If you are on the free plan, check your AI edit usage counter — free users get 6 AI edits shared across all projects (voiceover regen costs 3, other edits cost 1). Buy a video for +20, or upgrade to Pro for unlimited edits.

Error: "Failed to load layouts."
Why it happens: The available scene layouts could not be fetched from the server. This is a temporary connectivity issue.
What to do: Close the edit modal and try opening it again. If it still fails, refresh the page.

== AI EDITING ERRORS ==

Error: "AI editing limit reached. Upgrade to Pro for unlimited edits."
Why it happens: Free users get 6 AI-assisted scene edits shared across all projects (voiceover regen costs 3, other edits cost 1). Your pool is exhausted — or you have fewer than 3 left and asked to regenerate the voiceover.
What to do: Buy a video for +20 AI edits, or upgrade to Pro/Standard for unlimited edits. You can still make manual edits to any scene without using AI edit credits.

Error: "Please provide a description."
Why it happens: You tried to trigger an AI scene regeneration without entering any description of what you want changed.
What to do: Type a description of the visual or content change you want in the description field, then try again.

Error: "Display text is required when regenerating voiceover."
Why it happens: You enabled the voiceover regeneration toggle but the display text field is empty.
What to do: Enter the on-screen text for the scene in the display text field before regenerating.

== IMAGE ERRORS ==

Error: "Image generation failed."
Why it happens: The AI image generation request failed. This can happen due to a service outage, an unsupported prompt, or a temporary quota issue.
What to do: Try generating again with a different or simpler description. If it fails repeatedly, try uploading an image manually instead.

Error: "Failed to use generated image."
Why it happens: The AI image was generated successfully but could not be saved to the project. This is a temporary server issue.
What to do: Try the generation again, or upload an image file directly.

Error: "Failed to remove image."
Why it happens: The request to remove the image from the scene failed. Usually a temporary network issue.
What to do: Try again. If it persists, refresh the page and try removing the image again.

Error: "Failed to assign image."
Why it happens: Selecting an image from the gallery to assign to a scene failed.
What to do: Try clicking the image again. If it fails, refresh and try again.

Error: "Failed to delete image."
Why it happens: The request to permanently delete an image from your project's image library failed.
What to do: Try again after a moment.

== FILE UPLOAD ERRORS ==

Error: "[filename] is not supported. Use PDF, DOCX, PPTX, Markdown, TXT, or VTT."
Why it happens: You tried to upload a file type that Blog2Video cannot read. Only PDF, DOCX, PPTX, .md, .txt, and .vtt files are accepted.
What to do: Convert your file to a supported format. For Word documents make sure the file extension is .docx not .doc.

Error: "[filename] exceeds the 5 MB size limit."
Why it happens: The file you are trying to upload is larger than 5 MB.
What to do: Compress or reduce the file size, or split it into smaller parts.

Error: "Maximum [N] files allowed."
Why it happens: You are trying to upload more files than the allowed limit in one project.
What to do: Reduce the number of files to the allowed maximum.

Error: "Logo must be under 2 MB."
Why it happens: The logo file you are uploading exceeds the 2 MB size limit.
What to do: Compress the image or export it at a lower resolution before uploading.

== VOICE AND AUDIO ERRORS ==

Error: "Failed to load prebuilt voices."
Why it happens: The list of available voices could not be fetched. Usually a temporary server issue.
What to do: Refresh the page and try opening the voice picker again.

Error: "Could not add voice. Please try again."
Why it happens: Adding a new voice to your saved voices list failed.
What to do: Try again. If it fails repeatedly, refresh the page.

Error: "Failed to add voice. Try again."
Why it happens: The custom voice could not be added to your voice list.
What to do: Try adding it again after a moment.

Error: "Could not remove voice. Please try again."
Why it happens: Removing a voice from your list failed.
What to do: Try again. If the error persists, refresh the page.

Error: "At least one voice must remain in your list. Add more voices before removing this one."
Why it happens: You are trying to remove the only voice in your saved voices list. The list must always have at least one voice.
What to do: Add another voice first, then remove the one you want to delete.

Error: "Preview not ready yet. Try again in a moment."
Why it happens: The voice preview audio has not been generated yet or is still processing.
What to do: Wait a few seconds and try previewing again.

Error: "Generation failed."
Why it happens: The voice design generation from preset options failed. This is a temporary issue with the voice design service.
What to do: Try again with different preset options, or use a custom text prompt instead.

Error: "Could not delete custom voice. Please try again."
Why it happens: Deleting a custom voice from your account failed.
What to do: Try again after refreshing the page.

Error: "Failed to create voice clone. Please try again."
Why it happens: The voice cloning process failed. This can happen if the audio sample was too short, too noisy, or the service is temporarily unavailable.
What to do: Make sure your audio sample is at least 30 seconds of clear speech, then try again.

Error: "Could not discard clone. Try again."
Why it happens: The request to discard a voice clone in progress failed.
What to do: Refresh the page and try discarding again.

Error: "Failed to save. Try again."
Why it happens: Saving the voice clone settings failed.
What to do: Try saving again. If it fails, refresh the page.

== TEMPLATE ERRORS ==

Error: "Failed to start template relayout."
Why it happens: When you change the template for an existing project, the system attempts to rearrange all scenes to fit the new template. This error means that request failed to start.
What to do: Try changing the template again. If it fails repeatedly, refresh the page first.

Error: "This project cannot export slides because its custom template is missing."
Why it happens: The slide export feature requires the original custom template to be present. The template has been deleted.
What to do: Switch to a different template in project Settings, then export.

Error: "Daily AI generation limit reached. Try again tomorrow."
Why it happens: Custom template AI generation has a daily usage limit. You have reached the limit for today.
What to do: Wait until the next day to generate more custom templates.

== DOWNLOAD AND EXPORT ERRORS ==

Error: "Video URL not found. Please wait for rendering to finish."
Why it happens: You tried to download the video before rendering finished, or the rendered file is still being uploaded to storage.
What to do: Wait for the render to fully complete and the download button to become active, then try downloading.

Error: "Could not start download. Try right-clicking the video and 'Save As'."
Why it happens: The browser blocked or failed to trigger the automatic download.
What to do: Right-click on the video player and choose Save video as, or try a different browser.

Error: "Could not export scenes."
Why it happens: The scene-by-scene slide export failed.
What to do: Make sure the preview has fully loaded (you can see the video playing), then try exporting again.

Error: "Wait until the preview has finished loading, then try again."
Why it happens: You tried to export slides before the Remotion preview player finished loading all frames.
What to do: Wait for the preview to fully load — the scrubber should be active and the video should be playable — then try exporting.

== EMBED AND SHARE ERRORS ==

Error: "Could not generate embed link. Please try again."
Why it happens: The server could not create an embed token for your video. This is a temporary server issue.
What to do: Try generating the embed link again after a moment.

Error: "Could not generate preview link. Please try again."
Why it happens: Same as above — the shareable preview link could not be generated.
What to do: Try again. If it fails repeatedly, refresh the page.

== AUTHENTICATION AND CHECKOUT ERRORS ==

Error: "Authentication failed. Please try again."
Why it happens: Google sign-in returned an error or the login process failed.
What to do: Try signing in again. If the problem persists, try a different browser or clear your cookies.

Error: "Google sign-in failed."
Why it happens: The Google OAuth flow could not be completed. This can happen if pop-ups are blocked or cookies are disabled.
What to do: Allow pop-ups for this site, enable third-party cookies, and try again.

Error: "Checkout failed. Please try again."
Why it happens: The Stripe checkout session could not be created. This is usually a temporary server issue.
What to do: Try clicking the upgrade button again. If it fails multiple times, try refreshing the page first.

Error: "Failed to reactivate account."
Why it happens: The account reactivation request failed after a deleted account tried to sign back in.
What to do: Try again. If it continues to fail, contact support.

== ACCOUNT ERRORS ==

Error: "Failed to delete account."
Why it happens: The account deletion request failed due to a server issue.
What to do: Try again from the account settings page. If it persists, contact support.

== PASSWORD PROTECTION ERRORS ==

Error: "Incorrect password. N attempt(s) remaining."
Why it happens: The password you entered for a password-protected page is wrong. After 5 failed attempts the page locks for 10 minutes.
What to do: Check the password carefully and try again. If you have forgotten it, contact the person who shared the link.

Error: "Too many attempts. Locked for 10 minutes."
Why it happens: You entered the wrong password 5 times in a row. The page is temporarily locked to prevent brute-force access.
What to do: Wait 10 minutes, then try again with the correct password.

== GENERIC ERRORS ==

Error: "We got an unexpected error, please try again or contact support."
Why it happens: An unhandled error occurred that the app could not categorize. This is rare and usually caused by a temporary server or network issue.
What to do: Refresh the page and try the action again. If the error keeps appearing, contact support and describe what you were doing when it happened.

Error: "Something went wrong. Please try again."
Why it happens: A general failure with no specific cause detected.
What to do: Try the action again. If it continues, refresh the page.

Error: "Sorry — something went wrong. Please try again in a moment."
Why it happens: The support chat failed to process your message. Usually a temporary server issue.
What to do: Wait a moment and send your message again.
`.trim(),
};
