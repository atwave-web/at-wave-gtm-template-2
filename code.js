// Require the necessary APIs
const logToConsole = require("logToConsole");
const injectScript = require("injectScript");
const queryPermission = require("queryPermission");
const getUrl = require("getUrl");
const parseUrl = require("parseUrl");
const log = logToConsole;
const getCookieValues = require("getCookieValues");
const setCookie = require("setCookie");
const localStorage = require("localStorage");
const json = require("JSON");
const encodeUriComponent = require("encodeUriComponent");
const generateRandom = require("generateRandom");
const sendPixel = require("sendPixel");

// Get the user data
const offerId = data.offerId;
const eventId = data.eventId;
const trackingType = data.trackingType;
const transactionId = data.transactionId;
const preventDuplicateTransactions = data.preventDuplicateTransactions;
const testUrl = data.testUrl;
// Get and/or set the requestSessionID
const currentUrl = testUrl || getUrl();
const parsedUrl = parseUrl(currentUrl);
let isDirectLinking = false;

// Set session and transaction id keys
const sessionIdKey = "__request_session_id_at_wave";
const transactionIdKey = "__transaction_id_at_wave";
const ckmReqIdKey = "__ckm_req_id_at_wave";
const thirdPartyIdKey = "__ckm_third_party_id_at_wave";
const creativeIdKey = "__ckm_creative_id_at_wave";
const activeTrackingKey = "__ckm_active_tracking_at_wave";

// Generate base variables
let transactionLocalStorageIDs = localStorage.getItem(transactionIdKey);
transactionLocalStorageIDs = transactionLocalStorageIDs
  ? json.parse(transactionLocalStorageIDs)
  : [];
let transactionCookieIDs = getCookieValues(transactionIdKey);
transactionCookieIDs = transactionCookieIDs.length
  ? json.parse(transactionCookieIDs[0])
  : [];

// Utility to write transaction cookies
const writeTransactionCookie = () => {
  if (transactionCookieIDs.indexOf(transactionId) === -1) {
    transactionCookieIDs.push(transactionId);
    setCookie(transactionIdKey, json.stringify(transactionCookieIDs), {
      domain: "auto",
      path: "/",
      "max-age": 2592000,
      secure: true,
      samesite: "lax",
    });
  }
  return;
};

// Utility to write to transaction localStorage
const writeTransactionLocalStorage = () => {
  if (transactionLocalStorageIDs.indexOf(transactionId) === -1) {
    transactionLocalStorageIDs.push(transactionId);
    localStorage.setItem(
      transactionIdKey,
      json.stringify(transactionLocalStorageIDs)
    );
  }
  return;
};

const fireDynamicClickPixel = () => {
  // Configuration object for CKM tracking
  const c = {
    name: "cp",
    args: {
      sess_timeout: "",
      gclid_param: "gclid",
      gclid_chk_ref: 0,
      bingkw_param: "ckm_kw",
      sc_param: "ckmsc",
      bingkw_chk_ref: 0,
      attr_param: "ckmsc",
      attr_chk_ref: 0,
      sess_param: "",
      sess_chk_ref: 0,
      crtv_id: null,
      crtv_param: "ckmc",
      crtv_chk_ref: 0,
      tpcrid_param: "ckmcrn",
      cookie_dom: "auto",
      site_dom: parsedUrl.hostname,
      ref_type: 1,
      ckm_sess_param: null,
      s1_param: "s1",
      s2_param: "s2",
      s3_param: "s3",
      s4_param: "s4",
      s5_param: "s5",
      sub_chk_ref: 0,
    },
  };

  // Get URL parameters
  const thirdPartyID = parsedUrl.searchParams.ckmsc;
  const creativeID = parsedUrl.searchParams.ckmc;
  const activeTracking = parsedUrl.searchParams.ckmat;

  // Only proceed if we have one of the required parameters
  if (thirdPartyID || creativeID || activeTracking) {
    log("AtWave: CKM tracking parameters found, initializing tracking");

    // Inject the CKM library script
    const ckmLibUrl = "//cakecdn.com/jssdk/lib.js";

    const onCkmSuccess = () => {
      log("AtWave: CKM library loaded successfully");
      // The library will be available in the global scope after loading
      // We'll push our config to the queue which will be processed by the library
      const scriptToInject =
        "(function() { var config = " +
        json.stringify(c) +
        "; if (typeof CKMLib == 'object') { CKMLib.run(config); } else { (_ckm = window._ckm || []).push(config); } })();";

      // Inject the configuration script
      injectScript(
        "data:text/javascript;charset=utf-8," +
          encodeUriComponent(scriptToInject),
        () => log("AtWave: CKM config script injected successfully"),
        () => log("AtWave: CKM config script injection failed")
      );
    };

    const onCkmFailure = () => {
      log("AtWave: CKM library load failed");
    };

    // Check permissions and inject the CKM library
    if (queryPermission("inject_script", ckmLibUrl)) {
      log("AtWave: Loading CKM library from " + ckmLibUrl);
      injectScript(ckmLibUrl, onCkmSuccess, onCkmFailure);
    } else {
      log("AtWave: CKM library load failed due to permissions mismatch");
    }
  } else {
    log("AtWave: No CKM tracking parameters found, skipping CKM tracking");
  }
};

const fireConversionPixel = () => {
  log("AtWave: Firing conversion pixel");

  // Get stored CKM request ID from localStorage or cookies
  const ckmReqIdLocalStorage = localStorage.getItem(ckmReqIdKey);
  let ckmReqIdCookie = getCookieValues(ckmReqIdKey);
  ckmReqIdCookie = ckmReqIdCookie.length > 0 ? ckmReqIdCookie[0] : null;
  const ckmReqId = ckmReqIdLocalStorage || ckmReqIdCookie;

  // Build the conversion URL
  let conversionUrl =
    "https://yellowglowmix.com/p.ashx?o=" +
    encodeUriComponent(offerId || "ENTER OFFER ID HERE") +
    "&e=" +
    encodeUriComponent(eventId || "ENTER EVENT ID HERE") +
    "&f=pb" +
    "&r=" +
    encodeUriComponent(ckmReqId || "");

  if (transactionId) {
    conversionUrl = conversionUrl + "&t=" + encodeUriComponent(transactionId);
  }

  log("AtWave: Conversion URL: " + conversionUrl);

  const onConversionSuccess = () => {
    log("AtWave: Conversion pixel sent successfully");
  };

  const onConversionFailure = () => {
    log("AtWave: Conversion pixel send failed");
  };

  // Send the conversion pixel
  if (queryPermission("send_pixel", conversionUrl)) {
    log("AtWave: Sending conversion pixel to " + conversionUrl);
    sendPixel(conversionUrl, onConversionSuccess, onConversionFailure);
  } else {
    log("AtWave: Conversion pixel send failed due to permissions mismatch");
  }
};

const clearDirectLinkingCookies = () => {
  log("AtWave: Clearing direct linking cookies due to utm_clickid presence");
  // Clear localStorage for all direct linking parameters
  localStorage.removeItem(ckmReqIdKey);
  localStorage.removeItem(thirdPartyIdKey);
  localStorage.removeItem(creativeIdKey);
  localStorage.removeItem(activeTrackingKey);

  // Clear cookies by setting them to expire
  const cookieOptions = {
    domain: "auto",
    path: "/",
    "max-age": 0,
    secure: true,
    samesite: "lax",
  };

  setCookie(ckmReqIdKey, "", cookieOptions);
  setCookie(thirdPartyIdKey, "", cookieOptions);
  setCookie(creativeIdKey, "", cookieOptions);
  setCookie(activeTrackingKey, "", cookieOptions);
};

const clearUtmClickIdCookies = () => {
  log(
    "AtWave: Clearing UTM click ID cookies due to direct linking parameters presence"
  );
  // Clear localStorage
  localStorage.removeItem(sessionIdKey);
  // Clear cookie by setting it to expire
  setCookie(sessionIdKey, "", {
    domain: "auto",
    path: "/",
    "max-age": 0,
    secure: true,
    samesite: "lax",
  });
};

const handleDirectLinking = () => {
  let ckmReqId = parsedUrl.searchParams.ckmreqid;
  const thirdPartyID = parsedUrl.searchParams.ckmsc;
  const creativeID = parsedUrl.searchParams.ckmc;
  const activeTracking = parsedUrl.searchParams.ckmat;
  // handle initial page view
  if (ckmReqId || thirdPartyID || creativeID || activeTracking) {
    if (!ckmReqId) {
      ckmReqId = generateRandom(1000000000, 9999999999).toString();
    }
    log("enabling direct linking tracking");
    log(
      "direct linking parameters found - ckmreqid: " +
        ckmReqId +
        ", ckmsc: " +
        thirdPartyID +
        ", ckmc: " +
        creativeID +
        ", ckmat: " +
        activeTracking
    );
    isDirectLinking = true;

    const cookieOptions = {
      domain: "auto",
      path: "/",
      "max-age": 2592000,
      secure: true,
      samesite: "lax",
    };

    // Store each parameter that exists
    if (ckmReqId) {
      localStorage.setItem(ckmReqIdKey, ckmReqId);
      setCookie(ckmReqIdKey, ckmReqId, cookieOptions);
    }
    if (thirdPartyID) {
      localStorage.setItem(thirdPartyIdKey, thirdPartyID);
      setCookie(thirdPartyIdKey, thirdPartyID, cookieOptions);
    }
    if (creativeID) {
      localStorage.setItem(creativeIdKey, creativeID);
      setCookie(creativeIdKey, creativeID, cookieOptions);
    }
    if (activeTracking) {
      localStorage.setItem(activeTrackingKey, activeTracking);
      setCookie(activeTrackingKey, activeTracking, cookieOptions);
    }

    fireDynamicClickPixel();
  }

  // Conversion tracking

  // Get all stored direct linking parameters from localStorage and cookies
  const ckmReqIdLocalStorage = localStorage.getItem(ckmReqIdKey);
  const thirdPartyIdLocalStorage = localStorage.getItem(thirdPartyIdKey);
  const creativeIdLocalStorage = localStorage.getItem(creativeIdKey);
  const activeTrackingLocalStorage = localStorage.getItem(activeTrackingKey);

  let ckmReqIdCookie = getCookieValues(ckmReqIdKey);
  ckmReqIdCookie = ckmReqIdCookie.length > 0 ? ckmReqIdCookie[0] : null;
  let thirdPartyIdCookie = getCookieValues(thirdPartyIdKey);
  thirdPartyIdCookie =
    thirdPartyIdCookie.length > 0 ? thirdPartyIdCookie[0] : null;
  let creativeIdCookie = getCookieValues(creativeIdKey);
  creativeIdCookie = creativeIdCookie.length > 0 ? creativeIdCookie[0] : null;
  let activeTrackingCookie = getCookieValues(activeTrackingKey);
  activeTrackingCookie =
    activeTrackingCookie.length > 0 ? activeTrackingCookie[0] : null;

  // Check if any direct linking parameters exist in storage
  const hasStoredParams =
    ckmReqIdLocalStorage ||
    thirdPartyIdLocalStorage ||
    creativeIdLocalStorage ||
    activeTrackingLocalStorage ||
    ckmReqIdCookie ||
    thirdPartyIdCookie ||
    creativeIdCookie ||
    activeTrackingCookie;

  if (hasStoredParams && trackingType === "conversion") {
    let foundParams = [];
    if (ckmReqIdLocalStorage || ckmReqIdCookie) foundParams.push("ckmreqid");
    if (thirdPartyIdLocalStorage || thirdPartyIdCookie)
      foundParams.push("ckmsc");
    if (creativeIdLocalStorage || creativeIdCookie) foundParams.push("ckmc");
    if (activeTrackingLocalStorage || activeTrackingCookie)
      foundParams.push("ckmat");

    const storageSource =
      ckmReqIdLocalStorage ||
      thirdPartyIdLocalStorage ||
      creativeIdLocalStorage ||
      activeTrackingLocalStorage
        ? "local storage"
        : "cookies";

    log(
      "Atwave: found stored direct linking parameters (" +
        foundParams.join(", ") +
        ") in " +
        storageSource +
        " and event id " +
        eventId,
      "ckmreqid: " +
        ckmReqIdLocalStorage +
        ", ckmsc: " +
        thirdPartyIdLocalStorage +
        ", ckmc: " +
        creativeIdLocalStorage +
        ", ckmat: " +
        activeTrackingLocalStorage
    );
    fireConversionPixel();
  } else {
    log(
      "AtWave: no stored direct linking parameters found for conversion tracking"
    );
  }
};

const handleUtmClickId = () => {
  // Return true if either transactionCookieIDs or transactionLocalStorageIDs has the current transaction ID
  const preventDuplicate =
    transactionId && preventDuplicateTransactions
      ? transactionCookieIDs.indexOf(transactionId) > -1 ||
        transactionLocalStorageIDs.indexOf(transactionId) > -1
      : false;

  const utmClickId = parsedUrl.searchParams.utm_clickid;
  let requestSessionId;
  if (utmClickId) {
    localStorage.setItem(sessionIdKey, utmClickId);
    setCookie(sessionIdKey, utmClickId, {
      domain: "auto",
      path: "/",
      "max-age": 2592000,
      secure: true,
      samesite: "lax",
    });
    requestSessionId = utmClickId;
    log("utmClikcId found in url: " + utmClickId);
  } else {
    // Get session Ids if available
    const sessionLocalStorageID = localStorage.getItem(sessionIdKey);
    let sessionCookieID = getCookieValues(sessionIdKey);
    sessionCookieID = sessionCookieID.length > 0 ? sessionCookieID[0] : null;
    requestSessionId = sessionLocalStorageID || sessionCookieID;
    const idFrom = sessionLocalStorageID ? "local storage" : "cookies";

    if (requestSessionId) {
      const message =
        "Atwave: found request session id " +
        requestSessionId +
        " in " +
        idFrom;
      log(message);
    } else {
      log("AtWave: no session id found in local storage or cookies");
    }
  }

  if (preventDuplicate) {
    log(
      "AtWave: Prevented pixel because of duplicate transaction " +
        transactionId
    );
  }
  if (requestSessionId) {
    // Generate the url
    let url =
      "https://scalebus.com/p.ashx?o=" +
      encodeUriComponent(offerId) +
      "&r=" +
      encodeUriComponent(requestSessionId) +
      "&f=js";

    if (eventId) {
      url = url + "&e=" + encodeUriComponent(eventId);
    }
    if (transactionId) {
      url = url + "&t=" + encodeUriComponent(transactionId);
    }

    // If the script loaded successfully, log a message and signal success
    const onSuccess = () => {
      log("AtWave: Script loaded successfully.");
      // Write the transaction Id to local stores and cookie if desired
      if (transactionId && preventDuplicateTransactions) {
        writeTransactionLocalStorage();
        writeTransactionCookie();
        log(
          "AtWave: Store transaction id " +
            transactionId +
            " in local storage and cookie"
        );
      }
      data.gtmOnSuccess();
    };

    // If the script fails to load, log a message and signal failure
    const onFailure = () => {
      log("AtWave: Script load failed.");
      data.gtmOnFailure();
    };

    // If the URL input by the user matches the permissions set for the template,
    // inject the script with the onSuccess and onFailure methods as callbacks.
    if (queryPermission("inject_script", url)) {
      if (trackingType === "conversion") {
        log("Atwave: Loading script from " + url);
        injectScript(url, onSuccess, onFailure);
      } else {
        log("Atwave: pageview event. No script fired.");
        data.gtmOnSuccess();
      }
    } else {
      log("AtWave: Script load failed due to permissions mismatch.");
      data.gtmOnFailure();
    }
  } else {
    log("AtWave: No Request Session ID. No script loaded.");
    data.gtmOnSuccess();
  }
};

const main = () => {
  // Check for utm_clickid and direct linking parameters
  const utmClickId = parsedUrl.searchParams.utm_clickid;
  const ckmReqId = parsedUrl.searchParams.ckmreqid;
  const thirdPartyID = parsedUrl.searchParams.ckmsc;
  const creativeID = parsedUrl.searchParams.ckmc;
  const activeTracking = parsedUrl.searchParams.ckmat;

  // Check if any direct linking parameters are present
  const hasDirectLinkingParams =
    ckmReqId || thirdPartyID || creativeID || activeTracking;

  if (utmClickId && hasDirectLinkingParams) {
    log(
      "AtWave: Both utm_clickid and direct linking parameters found - utm_clickid takes precedence"
    );
    clearDirectLinkingCookies();
    handleUtmClickId();
  } else if (utmClickId) {
    log(
      "AtWave: utm_clickid found, skipping direct linking and clearing direct linking cookies"
    );
    clearDirectLinkingCookies();
    handleUtmClickId();
  } else if (hasDirectLinkingParams) {
    log(
      "AtWave: Direct linking parameters found, skipping UTM click ID and clearing UTM cookies"
    );
    clearUtmClickIdCookies();
    handleDirectLinking();
  } else {
    handleUtmClickId();
    handleDirectLinking();
    log(
      "AtWave: No utm_clickid or direct linking parameters found, not firing any pixels"
    );
  }
};

main();
