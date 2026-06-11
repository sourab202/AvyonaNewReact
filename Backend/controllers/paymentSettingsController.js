import { ApiError } from "../utils/apiError.js";
import {
  getActiveRazorpayCredentials,
  getPaymentSettings,
  savePaymentSettings
} from "../services/paymentSettings.js";

const razorpayApiBaseUrl = "https://api.razorpay.com/v1";

function getRazorpayErrorMessage(payload, fallback) {
  return String(payload?.error?.description || payload?.error?.reason || fallback).trim();
}

export async function getAdminPaymentSettings(_request, response) {
  response.json({
    success: true,
    data: await getPaymentSettings()
  });
}

export async function getPublicPaymentSettings(_request, response) {
  const credentials = await getActiveRazorpayCredentials();
  const settings = await getPaymentSettings();

  response.json({
    success: true,
    data: {
      provider: credentials.provider,
      enabled: credentials.enabled && Boolean(credentials.keyId && credentials.keySecret),
      mode: credentials.mode,
      keyId: credentials.keyId,
      currency: credentials.currency,
      buttonText: credentials.buttonText,
      description: credentials.description,
      codEnabled: settings.codEnabled
    }
  });
}

export async function updateAdminPaymentSettings(request, response) {
  const incomingSettings = request.body?.settings || request.body;

  if (!incomingSettings || typeof incomingSettings !== "object" || Array.isArray(incomingSettings)) {
    throw new ApiError(400, "A valid payment settings object is required");
  }

  const settings = await savePaymentSettings(incomingSettings);

  response.json({
    success: true,
    message: "Payment settings saved successfully",
    data: settings
  });
}

export async function testAdminRazorpayConnection(_request, response) {
  const credentials = await getActiveRazorpayCredentials();

  if (!credentials.keyId || !credentials.keySecret) {
    throw new ApiError(
      400,
      `Razorpay ${credentials.mode} Key ID and Key Secret are required before testing the connection`
    );
  }

  const authorization = Buffer.from(
    `${credentials.keyId}:${credentials.keySecret}`,
    "utf8"
  ).toString("base64");

  let razorpayResponse;
  try {
    razorpayResponse = await fetch(`${razorpayApiBaseUrl}/orders?count=1`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`
      },
      signal: AbortSignal.timeout(10_000)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new ApiError(504, "Razorpay connection test timed out");
    }
    throw new ApiError(502, "Unable to connect to Razorpay");
  }

  let payload = {};
  try {
    payload = await razorpayResponse.json();
  } catch {
    payload = {};
  }

  if (!razorpayResponse.ok) {
    const statusCode = razorpayResponse.status === 401 ? 400 : 502;
    throw new ApiError(
      statusCode,
      getRazorpayErrorMessage(payload, "Razorpay rejected the configured credentials")
    );
  }

  response.json({
    success: true,
    message: `Razorpay ${credentials.mode} connection is working`,
    data: {
      provider: credentials.provider,
      mode: credentials.mode,
      keyId: credentials.keyId,
      connected: true
    }
  });
}
