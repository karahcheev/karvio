export type NewApiKeyData = {
  name: string;
  description: string;
};

export type ConfirmActionTarget = {
  id: string;
  name: string;
};

export type NewlyCreatedKey = {
  id: string;
  value: string;
  name: string;
};
