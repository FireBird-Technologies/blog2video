import api from "./http";

export interface EnterpriseContactPayload {
  name: string;
  company: string;
  contact_details: string;
  message: string;
}

export const sendEnterpriseContact = (payload: EnterpriseContactPayload) =>
  api.post("/contact/enterprise", payload);

