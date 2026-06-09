import { adminApi } from "./adminApi";

export function fetchCustomers() {
  return adminApi.get("/customers");
}

export function fetchCustomerById(customerId) {
  return adminApi.get(`/customers/${customerId}`);
}

export function updateCustomerBusinessDetails(customerId, payload) {
  return adminApi.patch(`/customers/${customerId}/business-details`, payload);
}
