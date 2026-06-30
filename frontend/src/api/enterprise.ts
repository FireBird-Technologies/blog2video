import api from "./http";

export interface EnterpriseContactPayload {
  name: string;
  company: string;
  contact_details: string;
  message: string;
  /** Set by the landing "Your Own Brand" CTA so the email is styled as a designer-template request. */
  is_designer_request?: boolean;
}

export const sendEnterpriseContact = (payload: EnterpriseContactPayload) =>
  api.post("/contact/enterprise", payload);

export interface CustomTemplateRequestPayload {
  description: string;
  alternate_contact?: string;
  company_information?: string;
}

export const sendCustomTemplateRequest = (payload: CustomTemplateRequestPayload) =>
  api.post("/contact/custom-template-request", payload);

