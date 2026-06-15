import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Enable CORS for frontend clients (e.g. GitHub Pages)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================
// CONFIGURATION & SUPABASE REST API CLIENT
// ============================================================
const SUPABASE_URL = "https://lsvackdwzllxsqzoxbnb.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdmFja2R3emxseHNxem94Ym5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODY1MDQ0NywiZXhwIjoyMDk0MjI2NDQ3fQ.crVCdVAhlmB5O7nAzFdxKyuF2tMO2M-1PfQidfAD3Y8";

async function sbRequest(method: string, urlPath: string, body?: any, params?: any) {
  let url = SUPABASE_URL + urlPath;

  if (params) {
    const qs = Object.keys(params)
      .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
      .join("&");
    if (qs) url += "?" + qs;
  }

  const headers: Record<string, string> = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
    "Content-Type": "application/json",
    "Prefer": "return=representation"
  };

  const options: RequestInit = {
    method: method,
    headers: headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const code = response.status;
    const text = await response.text();

    if (code < 200 || code >= 300) {
      console.error(`Supabase Error [${code}] ${urlPath} → ${text}`);
      throw new Error(`Supabase ${code}: ${text}`);
    }

    if (code === 204 || text.trim() === "") return null;

    return JSON.parse(text);
  } catch (err: any) {
    console.error(`sbRequest Exception on ${urlPath}:`, err);
    throw err;
  }
}

async function sbSelect(table: string, select?: string, filters?: any, order?: string) {
  const params = Object.assign({ select: select || "*" }, filters || {});
  if (order) params.order = order;
  return (await sbRequest("GET", `/rest/v1/${table}`, null, params)) || [];
}

async function sbInsert(table: string, data: any) {
  return await sbRequest("POST", `/rest/v1/${table}`, data);
}

async function sbUpdate(table: string, data: any, filters: any) {
  return await sbRequest("PATCH", `/rest/v1/${table}`, data, filters);
}

async function sbDelete(table: string, filters: any) {
  return await sbRequest("DELETE", `/rest/v1/${table}`, null, filters);
}

async function sbSelectOne(table: string, select: string, filters: any) {
  const rows = await sbSelect(table, select, Object.assign({}, filters, { limit: "1" }));
  return rows.length > 0 ? rows[0] : null;
}

// ─── STORAGE HELPERS ────────────────────────────────────────

async function ensureBucketExists(bucket: string) {
  const url = `${SUPABASE_URL}/storage/v1/bucket`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: true
      })
    });
    const code = response.status;
    const text = await response.text();
    console.log(`ensureBucketExists for '${bucket}' completed with code ${code}: ${text.slice(0, 100)}`);
  } catch (err: any) {
    console.warn(`ensureBucketExists for '${bucket}' error:`, err.message);
  }
}

async function sbUploadFile(bucket: string, filePath: string, contentBuffer: Buffer, contentType: string) {
  await ensureBucketExists(bucket);
  contentType = contentType || "text/html";
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body: contentBuffer
    });

    const code = response.status;
    const text = await response.text();

    if (code < 200 || code >= 300) {
      throw new Error(`Storage upload failed [${code}]: ${text}`);
    }

    return sbGetPublicUrl(bucket, filePath);
  } catch (err: any) {
    console.error("sbUploadFile error:", err);
    throw err;
  }
}

function sbGetPublicUrl(bucket: string, filePath: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`;
}

async function sbGetSignedUrl(bucket: string, filePath: string, expiresInSeconds = 3600) {
  try {
    const result = await sbRequest(
      "POST",
      `/storage/v1/object/sign/${bucket}/${filePath}`,
      { expiresIn: expiresInSeconds }
    );
    if (result && result.signedURL) {
      // Supabase's sign API returns path starting with /
      return `${SUPABASE_URL}/storage/v1${result.signedURL}`;
    }
    // Fallback if sign API fails/changed
    return sbGetPublicUrl(bucket, filePath);
  } catch (error) {
    console.error("sbGetSignedUrl error:", error);
    return sbGetPublicUrl(bucket, filePath);
  }
}

async function sbDeleteFile(bucket: string, filePath: string) {
  try {
    await sbRequest("DELETE", `/storage/v1/object/${bucket}`, { prefixes: [filePath] });
  } catch (e) {
    console.warn("Delete file error (ignored):", e);
  }
}

// ─── SEQUENTIAL ID GENERATOR HELPERS ────────────────────────────────────

async function generateNextRequisitionId() {
  const yearShort = new Date().getFullYear().toString().slice(-2);
  const prefix = `REQ-${yearShort}`;

  const rows = await sbSelect("requisitions", "id",
    { id: `like.${prefix}*` },
    "id.desc"
  );

  if (!rows || rows.length === 0) {
    return prefix + "0001";
  }

  const lastId = rows[0].id;
  const lastNum = parseInt(lastId.slice(prefix.length)) || 0;
  return prefix + (lastNum + 1).toString().padStart(4, "0");
}

async function generateGoodsIssueId(prefixStr: string) {
  const yearShort = new Date().getFullYear().toString().slice(-2);

  const row = await sbSelectOne("id_counters", "*", {
    prefix: `eq.${prefixStr}`,
    year: `eq.${yearShort}`
  });

  let nextNum: number;
  if (!row) {
    await sbInsert("id_counters", { prefix: prefixStr, year: yearShort, last_counter: 1 });
    nextNum = 1;
  } else {
    nextNum = (row.last_counter || 0) + 1;
    await sbUpdate("id_counters",
      { last_counter: nextNum },
      { prefix: `eq.${prefixStr}`, year: `eq.${yearShort}` }
    );
  }

  return prefixStr + "-" + yearShort + nextNum.toString().padStart(4, "0");
}

async function generateDailyTransactionId(prefix = "TRN") {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const dateStr = `${prefix}-${yy}${mm}${dd}`;

  const rows = await sbSelect("transaction_logs", "transaction_id",
    { transaction_id: `like.${dateStr}*` }
  );

  const nextNum = (rows ? rows.length : 0) + 1;
  return dateStr + nextNum.toString().padStart(4, "0");
}

// ============================================================
// DEPARTMENTS & USER MANAGEMENT
// ============================================================

async function getDepartments() {
  try {
    const rows = await sbSelect("departments", "name", {}, "name.asc");
    return rows.map((r: any) => r.name);
  } catch (e) {
    console.error("getDepartments Error:", e);
    return [];
  }
}

async function registerUser(userData: any) {
  try {
    const existing = await sbSelectOne("users", "username", { username: `eq.${userData.username}` });
    if (existing) {
      return { success: false, message: "ชื่อผู้ใช้งานนี้มีอยู่แล้ว" };
    }

    const hashedPassword = "hashed_" + userData.password;
    await sbInsert("users", {
      username: userData.username,
      password: hashedPassword,
      name: userData.name,
      department: userData.department,
      role: userData.role || "User"
    });

    return { success: true };
  } catch (e: any) {
    console.error("registerUser Error:", e);
    return { success: false, message: e.message };
  }
}

async function loginUser(username: string, password: string) {
  try {
    const user = await sbSelectOne("users", "username,password,name,department,role",
      { username: `eq.${username}` }
    );

    if (user && user.password === "hashed_" + password) {
      return {
        username: user.username,
        name: user.name,
        department: user.department,
        role: user.role
      };
    }
    return null;
  } catch (e) {
    console.error("loginUser Error:", e);
    return null;
  }
}

async function updateUserProfile(userData: any) {
  try {
    const updateData: any = {
      name: userData.name,
      department: userData.department,
      updated_at: new Date().toISOString()
    };
    if (userData.password) {
      updateData.password = "hashed_" + userData.password;
    }

    const result = await sbUpdate("users", updateData, { username: `eq.${userData.username}` });
    if (!result || result.length === 0) {
      return { success: false, message: "ไม่พบผู้ใช้งาน" };
    }
    return { success: true };
  } catch (e: any) {
    console.error("updateUserProfile Error:", e);
    return { success: false, message: e.message };
  }
}

async function getAllUsers(adminUser: any) {
  if (!adminUser || adminUser.role !== "Admin") {
    return { error: true, message: "Unauthorized: Admin access required." };
  }
  try {
    const users = await sbSelect("users",
      "username,name,department,role,created_at,updated_at",
      {},
      "created_at.asc"
    );
    return users.map((u: any) => ({
      username: u.username,
      name: u.name,
      department: u.department,
      role: u.role,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));
  } catch (e: any) {
    console.error("getAllUsers Error:", e);
    return { error: true, message: e.message };
  }
}

async function updateUserByAdmin(userDataByAdmin: any, adminUser: any) {
  if (!adminUser || adminUser.role !== "Admin") {
    return { success: false, message: "Unauthorized: Admin access required." };
  }
  try {
    const updateData: any = {
      name: userDataByAdmin.name,
      department: userDataByAdmin.department,
      role: userDataByAdmin.role,
      updated_at: new Date().toISOString()
    };
    if (userDataByAdmin.newPassword && userDataByAdmin.newPassword.trim() !== "") {
      updateData.password = "hashed_" + userDataByAdmin.newPassword;
    }

    const result = await sbUpdate("users", updateData,
      { username: `eq.${userDataByAdmin.usernameToUpdate}` }
    );
    if (!result || result.length === 0) {
      return { success: false, message: "User not found." };
    }
    return { success: true };
  } catch (e: any) {
    console.error("updateUserByAdmin Error:", e);
    return { success: false, message: e.message };
  }
}

async function deleteUserByAdmin(usernameToDelete: string, adminUser: any) {
  if (!adminUser || adminUser.role !== "Admin") {
    return { success: false, message: "Unauthorized: Admin access required." };
  }
  if (adminUser.username === usernameToDelete) {
    return { success: false, message: "Admin cannot delete their own account." };
  }
  try {
    await sbDelete("users", { username: `eq.${usernameToDelete}` });
    return { success: true };
  } catch (e: any) {
    console.error("deleteUserByAdmin Error:", e);
    return { success: false, message: e.message };
  }
}

// ============================================================
// INVENTORY MANAGEMENT & IMAGES
// ============================================================

async function getInventoryItems() {
  try {
    const items = await sbSelect(
      "inventory",
      "id,code,name,category,unit,quantity,min_quantity,unit_price,location,created_at,updated_at,catalog(image_path)",
      {},
      "name.asc"
    );

    const mapped = await Promise.all(items.map(async (item: any) => {
      let imageUrl = null;
      if (item.catalog && item.catalog.image_path) {
        imageUrl = await sbGetSignedUrl("catalog-images", item.catalog.image_path);
      }
      return {
        id: item.id.toString(),
        code: item.code,
        name: item.name,
        category: item.category || "",
        unit: item.unit || "",
        quantity: item.quantity,
        minQuantity: item.min_quantity,
        UnitPrice: item.unit_price,
        Location: item.location || "",
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        imageUrl: imageUrl
      };
    }));
    return mapped;
  } catch (e: any) {
    console.error("getInventoryItems Error:", e, e.stack);
    return [];
  }
}

async function addInventoryItem(itemData: any) {
  try {
    const existing = await sbSelectOne("inventory", "id", { code: `eq.${itemData.code}` });
    if (existing) {
      return { success: false, message: "รหัสวัสดุนี้มีอยู่แล้ว" };
    }

    const rows = await sbInsert("inventory", {
      code: itemData.code,
      name: itemData.name,
      category: itemData.category,
      unit: itemData.unit,
      quantity: parseInt(itemData.quantity) || 0,
      min_quantity: parseInt(itemData.minQuantity) || 0,
      unit_price: parseFloat(itemData.unitPrice) || 0,
      location: itemData.location || ""
    });

    const newId = Array.isArray(rows) ? rows[0].id : rows.id;
    return { success: true, id: newId.toString() };
  } catch (e: any) {
    console.error("addInventoryItem Error:", e);
    return { success: false, message: e.message };
  }
}

async function updateInventoryItem(itemData: any) {
  try {
    const updatePayload = {
      code: itemData.code,
      name: itemData.name,
      category: itemData.category,
      unit: itemData.unit,
      quantity: parseInt(itemData.quantity) || 0,
      min_quantity: parseInt(itemData.minQuantity) || 0,
      unit_price: parseFloat(itemData.unitPrice) || 0,
      location: itemData.location || "",
      updated_at: new Date().toISOString()
    };

    const result = await sbUpdate("inventory", updatePayload, { id: `eq.${itemData.id}` });
    if (!result || result.length === 0) {
      return { success: false, message: "ไม่พบวัสดุ" };
    }
    return { success: true };
  } catch (e: any) {
    console.error("updateInventoryItem Error:", e);
    return { success: false, message: e.message };
  }
}

async function deleteInventoryItem(itemId: string) {
  try {
    await sbDelete("inventory", { id: `eq.${itemId}` });
    return { success: true };
  } catch (e: any) {
    console.error("deleteInventoryItem Error:", e);
    return { success: false, message: e.message };
  }
}

async function updateInventoryQuantities(itemsToUpdate: any[]) {
  if (!itemsToUpdate || itemsToUpdate.length === 0) {
    return { success: true };
  }
  try {
    for (const update of itemsToUpdate) {
      if (!update.quantityChange || update.quantityChange === 0) continue;

      const invRow = await sbSelectOne("inventory", "id,quantity,unit_price,code,name,unit",
        { id: `eq.${update.itemId}` }
      );
      if (!invRow) continue;

      const newQty = Math.max(0, (invRow.quantity || 0) + update.quantityChange);
      await sbUpdate("inventory",
        { quantity: newQty, updated_at: new Date().toISOString() },
        { id: `eq.${update.itemId}` }
      );

      if (update.requisitionId && update.quantityChange !== 0) {
        const noteSuffix = update.isBackorderFulfillment
          ? " (Backorder Fulfillment)"
          : (update.isAdditionalDispenseInBOFulFillment ? " (Additional in BO Fulfillment)" : "");

        const txnId = await generateDailyTransactionId("TRN");
        await recordTransaction({
          transactionId: txnId,
          timestamp: new Date().toISOString(),
          type: "Requisition Issue",
          referenceNo: update.requisitionId,
          itemId: update.itemId,
          itemCode: invRow.code,
          itemName: update.itemName || invRow.name,
          quantityChange: update.quantityChange,
          unit: update.unit || invRow.unit,
          unitPrice: invRow.unit_price,
          valueChange: update.quantityChange * invRow.unit_price,
          newStockQuantity: newQty,
          receivedBy: update.approvedByUsername,
          notes: "Issued for Requisition " + update.requisitionId + noteSuffix,
          source: "System (Requisition)"
        });
      }
    }

    return { success: true };
  } catch (e: any) {
    console.error("updateInventoryQuantities Error:", e);
    return { success: false, message: e.message };
  }
}

async function uploadInventoryImage(itemId: string, base64: string, mimeType: string) {
  try {
    const ext = (mimeType || "image/jpeg").split("/")[1] || "jpg";
    const path = "catalog/" + itemId + "." + ext;

    const contentBuffer = Buffer.from(base64, "base64");
    await sbUploadFile("catalog-images", path, contentBuffer, mimeType);

    const existing = await sbSelectOne("catalog", "item_id", { item_id: `eq.${itemId}` });
    if (existing) {
      await sbUpdate("catalog",
        { image_path: path, updated_at: new Date().toISOString() },
        { item_id: `eq.${itemId}` }
      );
    } else {
      await sbInsert("catalog", {
        item_id: parseInt(itemId),
        image_path: path
      });
    }

    const publicUrl = sbGetPublicUrl("catalog-images", path);
    return { success: true, imageUrl: publicUrl };

  } catch (e: any) {
    console.error("uploadInventoryImage Error:", e);
    return { success: false, message: e.message };
  }
}

async function deleteInventoryImage(itemId: string) {
  try {
    const cat = await sbSelectOne("catalog", "item_id,image_path",
      { item_id: `eq.${itemId}` }
    );

    if (cat && cat.image_path) {
      await sbDeleteFile("catalog-images", cat.image_path);
    }

    if (cat) {
      await sbUpdate("catalog",
        { image_path: null, updated_at: new Date().toISOString() },
        { item_id: `eq.${itemId}` }
      );
    }

    return { success: true };

  } catch (e: any) {
    console.error("deleteInventoryImage Error:", e);
    return { success: false, message: e.message };
  }
}

// ============================================================
// REQUISITIONS & APPROVAL WORKFLOW
// ============================================================

async function createRequisition(requisitionData: any, itemsData: any[]) {
  try {
    const requisitionId = await generateNextRequisitionId();
    const now = new Date().toISOString();
    const initialStatus = "Pending Manager Approval";

    const itemIds = itemsData.map(i => i.itemId);
    const invRows = await sbSelect("inventory", "id,code,name,unit,unit_price,location,quantity",
      { id: `in.(${itemIds.join(",")})` }
    );
    const invMap: Record<string, any> = {};
    invRows.forEach((r: any) => { invMap[r.id.toString()] = r; });

    const reqItemsForPdf = itemsData.map(item => {
      const inv = invMap[item.itemId.toString()] || {};
      const qty = parseInt(item.quantity) || 0;
      const price = inv.unit_price || 0;
      return {
        requisitionId: requisitionId,
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: qty,
        unit: item.unit,
        itemCode: inv.code || "N/A",
        location: inv.location || "N/A",
        UnitPrice: price,
        TotalPrice: qty * price,
        dispensedQuantity: 0,
        isBackordered: false,
        notesForItem: "",
        currentInventoryQuantity: inv.quantity || 0
      };
    });

    let pdfPath = null;
    try {
      const reqObj = {
        id: requisitionId,
        date: requisitionData.date,
        purpose: requisitionData.purpose,
        requestedBy: requisitionData.requestedBy,
        requestorName: requisitionData.requestorName,
        requestorDepartment: requisitionData.requestorDepartment,
        status: initialStatus,
        createdAt: now
      };
      const grandTotal = reqItemsForPdf.reduce((sum, item) => sum + (item.TotalPrice || 0), 0);
      pdfPath = await generateRequisitionFormPDF(requisitionId, reqObj, reqItemsForPdf, grandTotal);
    } catch (pdfErr: any) {
      console.warn("PDF generation failed (non-fatal):", pdfErr.message);
    }

    await sbInsert("requisitions", {
      id: requisitionId,
      date: requisitionData.date,
      purpose: requisitionData.purpose,
      requested_by: requisitionData.requestedBy,
      requestor_name: requisitionData.requestorName,
      requestor_department: requisitionData.requestorDepartment,
      status: initialStatus,
      requisition_pdf_path: pdfPath,
      created_at: now,
      updated_at: now
    });

    const itemRows = itemsData.map(item => {
      const inv = invMap[item.itemId.toString()] || {};
      const qty = parseInt(item.quantity) || 0;
      const price = inv.unit_price || 0;
      return {
        requisition_id: requisitionId,
        item_id: parseInt(item.itemId),
        item_name: item.itemName,
        quantity: qty,
        unit: item.unit,
        dispensed_quantity: 0,
        unit_price: price,
        is_backordered: false,
        notes_for_item: ""
      };
    });
    await sbInsert("requisition_items", itemRows);

    return { success: true, requisitionId: requisitionId };
  } catch (e: any) {
    console.error("createRequisition Error:", e, e.stack);
    return { success: false, message: e.message };
  }
}

async function getRequisitions(filters: any, username: string, role: string) {
  filters = filters || {};
  try {
    const params: any = { select: "*", order: "created_at.desc" };

    if (role && !["Admin", "Manager", "Staff"].includes(role)) {
      params.requested_by = `eq.${username}`;
    }

    if (filters.id) params.id = `ilike.%${filters.id}%`;
    if (filters.requestorName) params.requestor_name = `ilike.%${filters.requestorName}%`;
    if (filters.department && filters.department.trim() && filters.department !== "-- All --") {
      params.requestor_department = `ilike.%${filters.department}%`;
    }
    if (filters.status && filters.status.trim() && filters.status !== "-- All --") {
      params.status = `eq.${filters.status}`;
    }
    if (filters.startDate) params.date = `gte.${filters.startDate}`;
    if (filters.endDate) {
      params["date"] = params["date"]
        ? undefined
        : `lte.${filters.endDate}`;
    }

    let rows = await sbSelect("requisitions", "*", params);

    if (filters.startDate && filters.endDate) {
      const sd = new Date(filters.startDate);
      const ed = new Date(filters.endDate);
      ed.setHours(23, 59, 59, 999);
      rows = rows.filter((r: any) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        return d >= sd && d <= ed;
      });
    }

    return await Promise.all(rows.map((row: any) => _mapRequisitionRow(row)));
  } catch (e: any) {
    console.error("getRequisitions Error:", e);
    return [];
  }
}

async function getRequisitionDetails(requisitionId: string) {
  try {
    const req = await sbSelectOne("requisitions", "*", { id: `eq.${requisitionId}` });
    if (!req) return null;

    const items = await sbSelect("requisition_items", "*",
      { requisition_id: `eq.${requisitionId}` }
    );

    const itemIds = items.map((i: any) => i.item_id);
    const invRows = itemIds.length > 0
      ? await sbSelect("inventory",
        "id,code,name,unit,unit_price,location,quantity,catalog(image_path)",
        { id: `in.(${itemIds.join(",")})` }
      )
      : [];

    const invMap: Record<string, any> = {};
    for (const r of invRows) {
      let imgUrl = null;
      if (r.catalog && r.catalog.image_path) {
        imgUrl = await sbGetSignedUrl("catalog-images", r.catalog.image_path);
      }
      invMap[r.id.toString()] = {
        code: r.code,
        location: r.location,
        quantity: r.quantity,
        unit_price: r.unit_price,
        imageUrl: imgUrl
      };
    }

    const mappedReq = await _mapRequisitionRow(req);

    if (!req.requisition_pdf_path) {
      try {
        const reqItemsForPdf = items.map((item: any) => {
          const inv = invMap[item.item_id.toString()] || {};
          const qty = parseInt(item.quantity) || 0;
          const price = parseFloat(item.unit_price) || parseFloat(inv.unit_price) || 0;
          return {
            itemId: item.item_id,
            itemName: item.item_name,
            itemCode: inv.code || "-",
            quantity: qty,
            unit: item.unit,
            UnitPrice: price,
            TotalPrice: qty * price,
            location: inv.location || "-",
            dispensedQuantity: item.dispensed_quantity || 0,
            isBackordered: item.is_backordered || false,
            notesForItem: item.notes_for_item || "",
            currentInventoryQuantity: inv.quantity || 0
          };
        });
        const reqObj = {
          id: requisitionId,
          date: req.date,
          purpose: req.purpose,
          requestedBy: req.requested_by,
          requestorName: req.requestor_name,
          requestorDepartment: req.requestor_department,
          status: req.status,
          createdAt: req.created_at
        };
        const grandTotal = reqItemsForPdf.reduce((sum, item) => sum + (item.TotalPrice || 0), 0);
        const pdfPath = await generateRequisitionFormPDF(requisitionId, reqObj, reqItemsForPdf, grandTotal);
        if (pdfPath) {
          await sbUpdate("requisitions", { requisition_pdf_path: pdfPath }, { id: `eq.${requisitionId}` });
          mappedReq.RequisitionPDFLink = `/api/view-document?bucket=pdfs&path=${encodeURIComponent(pdfPath)}`;
        }
      } catch (pdfErr: any) {
        console.warn("Auto PDF generation in details failed:", pdfErr.message);
      }
    }

    return {
      requisition: mappedReq,
      items: items.map((item: any) => _mapItemRow(item, invMap))
    };
  } catch (e) {
    console.error("getRequisitionDetails Error:", e);
    return null;
  }
}

async function getPendingApprovals(username: string, role: string) {
  try {
    const statuses = [];
    if (role === "Manager" || role === "Admin") statuses.push("Pending Manager Approval");
    if (role === "Staff" || role === "Manager" || role === "Admin") statuses.push("Pending Stock Approval");
    if (role === "Admin" || role === "Staff") statuses.push("Partially Completed");

    if (statuses.length === 0) return [];

    let rows = await sbSelect("requisitions", "*",
      { status: `in.(${statuses.join(",")})` },
      "created_at.asc"
    );

    const seen: Record<string, boolean> = {};
    rows = rows.filter((r: any) => {
      if (seen[r.id]) return false;
      seen[r.id] = true;
      return true;
    });

    return await Promise.all(rows.map((row: any) => _mapRequisitionRow(row)));
  } catch (e) {
    console.error("getPendingApprovals Error:", e);
    return [];
  }
}

async function getRequisitionsForBatchApproval(filters: any, user: any) {
  if (!user || !["Admin", "Manager", "Staff"].includes(user.role)) {
    return { error: true, message: "Unauthorized access." };
  }
  try {
    let statusFilter: string;
    if (filters.level === "manager") {
      if (!["Admin", "Manager"].includes(user.role)) return [];
      statusFilter = "eq.Pending Manager Approval";
    } else if (filters.level === "stock") {
      statusFilter = "eq.Pending Stock Approval";
    } else {
      return [];
    }

    const params = { status: statusFilter, order: "created_at.asc" };
    let rows = await sbSelect("requisitions", "*", params);

    if (filters.startDate || filters.endDate) {
      const sd = filters.startDate ? new Date(filters.startDate) : null;
      const ed = filters.endDate ? new Date(filters.endDate) : null;
      if (ed) ed.setHours(23, 59, 59, 999);
      rows = rows.filter((r: any) => {
        if (!r.date) return false;
        const d = new Date(r.date);
        if (sd && d < sd) return false;
        if (ed && d > ed) return false;
        return true;
      });
    }

    const mappedReqs = await Promise.all(rows.map((row: any) => _mapRequisitionRow(row)));

    // Fetch items with current inventory for item-by-item batch visualizer
    const reqIds = mappedReqs.map(r => r.id);
    if (reqIds.length > 0) {
      const allItems = await sbSelect("requisition_items", "*", { requisition_id: `in.(${reqIds.join(",")})` });
      const itemIds = [...new Set(allItems.map((i: any) => i.item_id))];
      const invRows = itemIds.length > 0
        ? await sbSelect("inventory", "id,code,name,unit,unit_price,location,quantity", { id: `in.(${itemIds.join(",")})` })
        : [];
      const invMap: Record<string, any> = {};
      invRows.forEach((r: any) => {
        const payload = {
          code: r.code,
          location: r.location,
          quantity: r.quantity,
          unit_price: r.unit_price
        };
        invMap[r.id.toString()] = payload;
        invMap[Number(r.id)] = payload;
      });

      const itemsByReq: Record<string, any[]> = {};
      allItems.forEach((itm: any) => {
        if (!itemsByReq[itm.requisition_id]) {
          itemsByReq[itm.requisition_id] = [];
        }
        itemsByReq[itm.requisition_id].push(_mapItemRow(itm, invMap));
      });

      mappedReqs.forEach(r => {
        r.items = itemsByReq[r.id] || [];
      });
    }

    return mappedReqs;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function processBatchApproval(requisitionIds: string[], approverUsername: string, approvalLevel: string, approvalDecision: string, notes: string, customDraftItems?: Record<string, any[]>) {
  if (!requisitionIds || requisitionIds.length === 0) {
    return { success: false, message: "No requisition IDs provided." };
  }
  let processedCount = 0;
  try {
    for (const requisitionId of requisitionIds) {
      let clientDispensedItemsData: any[] = [];

      if (customDraftItems && customDraftItems[requisitionId]) {
        clientDispensedItemsData = customDraftItems[requisitionId];
      } else {
        if (approvalLevel === "stock" && approvalDecision === "Approved") {
          const items = await sbSelect("requisition_items", "*",
            { requisition_id: `eq.${requisitionId}` }
          );
          const itemIds = items.map((i: any) => i.item_id);
          const invRows = itemIds.length > 0
            ? await sbSelect("inventory", "id,quantity", { id: `in.(${itemIds.join(",")})` })
            : [];
          const stockMap: Record<string, number> = {};
          invRows.forEach((r: any) => { stockMap[r.id.toString()] = r.quantity || 0; });

          items.forEach((item: any) => {
            const currentStock = stockMap[item.item_id.toString()] || 0;
            const requestedQty = item.quantity || 0;
            const toDispense = Math.min(requestedQty, currentStock);
            clientDispensedItemsData.push({
              itemId: item.item_id.toString(),
              itemName: item.item_name,
              unit: item.unit,
              dispensedQuantity: toDispense,
              isBackordered: toDispense < requestedQty,
              itemNote: item.notes_for_item || "Batch Approved"
            });
          });
        } else if (approvalLevel === "manager" && approvalDecision === "Approved") {
          const items2 = await sbSelect("requisition_items", "*",
            { requisition_id: `eq.${requisitionId}` }
          );
          items2.forEach((item: any) => {
            clientDispensedItemsData.push({
              itemId: item.item_id.toString(),
              itemName: item.item_name,
              unit: item.unit,
              dispensedQuantity: item.quantity || 0,
              isBackordered: false,
              itemNote: item.notes_for_item || ""
            });
          });
        }
      }

      const result = await approveRequisition(
        requisitionId, approverUsername, approvalLevel,
        approvalDecision, notes, clientDispensedItemsData
      );
      if (!result.success) {
        throw new Error("การประมวลผลใบเบิก #" + requisitionId + " ล้มเหลว: " + result.message);
      }
      processedCount++;
    }

    return { success: true, processedCount: processedCount };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

async function processBatchApprovalByItem(decisions: any[], approverUsername: string, notes: string) {
  if (!decisions || decisions.length === 0) {
    return { success: false, message: "No decisions provided." };
  }

  try {
    const byReq: Record<string, any[]> = {};
    decisions.forEach(d => {
      if (!byReq[d.requisitionId]) byReq[d.requisitionId] = [];
      byReq[d.requisitionId].push(d);
    });

    let processedCount = 0;

    for (const reqId of Object.keys(byReq)) {
      const items = byReq[reqId];

      const clientItems = items.map(d => {
        return {
          itemId: d.itemId.toString(),
          itemName: d.itemName || "",
          unit: d.unit || "",
          dispensedQuantity: parseInt(d.dispensedQty) || 0,
          isBackordered: d.isBackordered || false,
          itemNote: d.note || "By-item batch dispatch"
        };
      });

      const result = await approveRequisition(
        reqId,
        approverUsername,
        "stock",
        "Approved",
        notes || ("By-item batch by " + approverUsername),
        clientItems
      );

      if (!result.success) {
        throw new Error(`REQ ${reqId} ล้มเหลว: ${result.message}`);
      }

      processedCount++;
    }

    return { success: true, processedCount: processedCount };

  } catch (e: any) {
    console.error("processBatchApprovalByItem Error:", e);
    return { success: false, message: e.message };
  }
}

async function approveRequisition(requisitionId: string, approverUsername: string, approvalLevel: string, approvalDecision: string, notes: string, clientDispensedItemsData: any[]) {
  try {
    const now = new Date().toISOString();

    const req = await sbSelectOne("requisitions", "*", { id: `eq.${requisitionId}` });
    if (!req) return { success: false, message: "ไม่พบใบเบิก" };

    const originalStatus = req.status;

    const approver = await sbSelectOne("users", "username,name", { username: `eq.${approverUsername}` });
    if (!approver) return { success: false, message: "ไม่พบข้อมูลผู้อนุมัติ" };

    const isManagerStep = approvalLevel === "manager" && originalStatus === "Pending Manager Approval";
    const isStockStep = approvalLevel === "stock" && originalStatus === "Pending Stock Approval";
    const isFulfillBackorder = approvalLevel === "fulfill_backorder" && originalStatus === "Partially Completed";
    const isFinalDispenseStep = isStockStep || isFulfillBackorder;

    const inventoryUpdateDeltas: any[] = [];
    let hasDispensedItems = false;

    if (approvalDecision === "Approved" && clientDispensedItemsData && clientDispensedItemsData.length > 0) {
      const allItems = await sbSelect("requisition_items", "*",
        { requisition_id: `eq.${requisitionId}` }
      );

      for (const clientItem of clientDispensedItemsData) {
        let sheetItem = null;
        for (let i = 0; i < allItems.length; i++) {
          if (allItems[i].item_id.toString() === clientItem.itemId.toString()) {
            sheetItem = allItems[i];
            break;
          }
        }
        if (!sheetItem) continue;

        const qtyDispensedThisAction = parseInt(clientItem.dispensedQuantity) || 0;
        let newCumulativeDispensed: number;

        if (isFulfillBackorder) {
          newCumulativeDispensed = (sheetItem.dispensed_quantity || 0) + qtyDispensedThisAction;
        } else {
          newCumulativeDispensed = qtyDispensedThisAction;
        }

        const requestedQty = sheetItem.quantity || 0;
        const isStillBackorder = clientItem.isBackordered || (newCumulativeDispensed < requestedQty);

        await sbUpdate("requisition_items",
          {
            dispensed_quantity: newCumulativeDispensed,
            is_backordered: isStillBackorder,
            notes_for_item: clientItem.itemNote || sheetItem.notes_for_item || ""
          },
          { id: `eq.${sheetItem.id}` }
        );

        if (isFinalDispenseStep && qtyDispensedThisAction > 0) {
          hasDispensedItems = true;
          inventoryUpdateDeltas.push({
            itemId: sheetItem.item_id.toString(),
            quantityChange: -qtyDispensedThisAction,
            requisitionId: requisitionId,
            approvedByUsername: approverUsername,
            itemName: sheetItem.item_name,
            unit: sheetItem.unit,
            isBackorderFulfillment: isFulfillBackorder,
            isAdditionalDispenseInBOFulFillment: isFulfillBackorder && !clientItem.isBackordered
          });
        }
      }
    }

    let newStatus = originalStatus;
    const reqUpdateData: any = { updated_at: now };

    if (isFulfillBackorder) {
      if (approvalDecision !== "Approved") {
        return { success: false, message: "การดำเนินการกับรายการค้างจ่ายต้องเป็น 'อนุมัติ'" };
      }
      const updatedItems = await sbSelect("requisition_items", "is_backordered",
        { requisition_id: `eq.${requisitionId}` }
      );
      const stillHasBackorder = updatedItems.some((i: any) => i.is_backordered === true);
      newStatus = stillHasBackorder ? "Partially Completed" : "Completed";

      const existingNote = req.stock_approval_note || "";
      const fulfillNote = "Fulfilled backorder by " + approver.name + " on " + new Date().toLocaleString("th-TH") + ". " + (notes || "").trim();
      reqUpdateData.stock_approval_note = existingNote ? existingNote + "\n" + fulfillNote : fulfillNote;

    } else if (isManagerStep) {
      reqUpdateData.manager_approver_username = approverUsername;
      reqUpdateData.manager_approver_name = approver.name;
      reqUpdateData.manager_approval_status = approvalDecision;
      reqUpdateData.manager_approval_date = now;
      reqUpdateData.manager_approval_note = notes || "";
      newStatus = approvalDecision === "Approved" ? "Pending Stock Approval" : "Rejected by Manager";

    } else if (isStockStep) {
      reqUpdateData.stock_approver_username = approverUsername;
      reqUpdateData.stock_approver_name = approver.name;
      reqUpdateData.stock_approval_status = approvalDecision;
      reqUpdateData.stock_approval_date = now;
      reqUpdateData.stock_approval_note = notes || "";

      if (approvalDecision === "Approved") {
        const itemsAfter = await sbSelect("requisition_items", "is_backordered",
          { requisition_id: `eq.${requisitionId}` }
        );
        const hasBO = itemsAfter.some((i: any) => i.is_backordered === true);
        newStatus = hasBO ? "Partially Completed" : "Completed";
      } else {
        newStatus = "Rejected by Stock";
      }

    } else if (approvalDecision === "Rejected") {
      if (approvalLevel === "manager") {
        reqUpdateData.manager_approver_username = approverUsername;
        reqUpdateData.manager_approver_name = approver.name;
        reqUpdateData.manager_approval_status = "Rejected";
        reqUpdateData.manager_approval_date = now;
        reqUpdateData.manager_approval_note = notes || "";
        newStatus = "Rejected by Manager";
      } else if (approvalLevel === "stock") {
        reqUpdateData.stock_approver_username = approverUsername;
        reqUpdateData.stock_approver_name = approver.name;
        reqUpdateData.stock_approval_status = "Rejected";
        reqUpdateData.stock_approval_date = now;
        reqUpdateData.stock_approval_note = notes || "";
        newStatus = "Rejected by Stock";
      }
    } else {
      return { success: false, message: "ระดับการอนุมัติหรือสถานะของใบเบิกไม่ถูกต้อง" };
    }

    reqUpdateData.status = newStatus;

    if (isFinalDispenseStep && approvalDecision === "Approved" && inventoryUpdateDeltas.length > 0) {
      await updateInventoryQuantities(inventoryUpdateDeltas);
    }

    if (isFinalDispenseStep && approvalDecision === "Approved" && hasDispensedItems) {
      try {
        const currentReq = await sbSelectOne("requisitions", "*", { id: `eq.${requisitionId}` });
        const allItemsForPdf = await sbSelect("requisition_items", "*",
          { requisition_id: `eq.${requisitionId}` }
        );

        const itemsForGiPdf: any[] = [];
        for (const clientItem of clientDispensedItemsData) {
          let baseItem = null;
          for (let i = 0; i < allItemsForPdf.length; i++) {
            if (allItemsForPdf[i].item_id.toString() === clientItem.itemId.toString()) {
              baseItem = allItemsForPdf[i];
              break;
            }
          }
          const invDetail = await sbSelectOne("inventory", "id,code,location,quantity",
            { id: `eq.${clientItem.itemId}` }
          ) || {};
          itemsForGiPdf.push({
            itemId: clientItem.itemId,
            itemName: clientItem.itemName || (baseItem ? baseItem.item_name : ""),
            quantity: baseItem ? baseItem.quantity : 0,
            unit: clientItem.unit || (baseItem ? baseItem.unit : ""),
            UnitPrice: baseItem ? baseItem.unit_price : 0,
            dispensedQuantity: parseInt(clientItem.dispensedQuantity) || 0,
            isBackordered: clientItem.isBackordered,
            itemCode: invDetail.code || "N/A",
            location: invDetail.location || "N/A",
            currentInventoryQuantity: invDetail.quantity !== undefined ? invDetail.quantity : 0,
            notesForItem: clientItem.itemNote || ""
          });
        }

        const giTypePrefix = isFulfillBackorder ? "GI2" : "GI1";
        const goodsIssueId = await generateGoodsIssueId(giTypePrefix);
        const pdfTitle = isFulfillBackorder ? "ใบจ่ายวัสดุค้างจ่าย" : "ใบจ่ายวัสดุ";

        const reqForPdf: any = await _mapRequisitionRow(currentReq || req);
        reqForPdf.goodsIssueId = goodsIssueId;
        reqForPdf.stockApproverName = approver.name;
        reqForPdf.stockApprovalDate = now;

        const giPdfPath = await generateGoodsIssuePDF(reqForPdf, itemsForGiPdf, pdfTitle);

        if (giPdfPath) {
          let currentLinks = [];
          const rawLinks = (currentReq || req).goods_issue_pdf_links;
          if (rawLinks) {
            currentLinks = typeof rawLinks === "string" ? JSON.parse(rawLinks) : rawLinks;
          }
          currentLinks.push({
            id: goodsIssueId,
            path: giPdfPath,
            type: giTypePrefix,
            date: now,
            issuedBy: approver.name
          });
          reqUpdateData.goods_issue_pdf_links = JSON.stringify(currentLinks);
        }
      } catch (pdfErr: any) {
        console.warn("GI PDF generation failed (non-fatal):", pdfErr.message);
      }
    }

    await sbUpdate("requisitions", reqUpdateData, { id: `eq.${requisitionId}` });
    await updateRequisitionPdf(requisitionId);

    return { success: true, newStatus: newStatus };
  } catch (e: any) {
    console.error("approveRequisition Error:", e, e.stack);
    return { success: false, message: e.message };
  }
}

async function manuallyCompleteRequisition(requisitionId: string, managerUser: any) {
  if (!managerUser || !["Admin", "Manager"].includes(managerUser.role)) {
    return { success: false, message: "Unauthorized" };
  }
  try {
    const req = await sbSelectOne("requisitions", "id,status,manager_approval_note",
      { id: `eq.${requisitionId}` }
    );
    if (!req) return { success: false, message: "Requisition not found." };
    if (req.status !== "Partially Completed") {
      return { success: false, message: "Action failed: Requisition is not in 'Partially Completed' status." };
    }

    const completionNote = "Manually force-completed by " + managerUser.name + " on " + new Date().toLocaleString("th-TH");
    const existingNote = req.manager_approval_note || "";

    await sbUpdate("requisitions",
      {
        status: "Completed",
        manager_approval_note: existingNote ? existingNote + "\n" + completionNote : completionNote,
        updated_at: new Date().toISOString()
      },
      { id: `eq.${requisitionId}` }
    );
    await updateRequisitionPdf(requisitionId);

    return { success: true, newStatus: "Completed" };
  } catch (e: any) {
    console.error("manuallyCompleteRequisition Error:", e);
    return { success: false, message: e.message };
  }
}

// ============================================================
// GOODS RECEIPT & TRANSACTION LOGS
// ============================================================

async function processGoodsReceiptServer(receiptInfo: any) {
  try {
    const referenceNo = receiptInfo.referenceNo;
    const receiptDate = receiptInfo.receiptDate;
    const notes = receiptInfo.notes;
    const receivedBy = receiptInfo.receivedByUsername;
    const source = receiptInfo.source;
    const items = receiptInfo.items;

    if (!items || items.length === 0) {
      return { success: false, message: "No items provided." };
    }

    const allInv = await sbSelect("inventory", "id,code,name,unit,quantity,unit_price");
    const invMapByCode: Record<string, any> = {};
    allInv.forEach((r: any) => {
      invMapByCode[r.code.trim().toLowerCase()] = r;
    });

    const results: any[] = [];
    let hadError = false;

    for (const item of items) {
      const code = item.itemCode.toString().trim().toLowerCase();
      const invItem = invMapByCode[code];

      if (!invItem) {
        results.push({ itemCode: item.itemCode, success: false, message: "Item code not found." });
        hadError = true;
        continue;
      }

      const qty = parseInt(item.quantityReceived);
      if (isNaN(qty) || qty <= 0) {
        results.push({ itemCode: item.itemCode, success: false, message: "Invalid quantity." });
        hadError = true;
        continue;
      }

      let txnUnitPrice = invItem.unit_price || 0;
      let updatePrice = false;
      if (item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(parseFloat(item.unitPrice))) {
        txnUnitPrice = parseFloat(item.unitPrice);
        updatePrice = (txnUnitPrice !== invItem.unit_price);
      }

      const newQty = (invItem.quantity || 0) + qty;
      const updatePayload: any = { quantity: newQty, updated_at: new Date().toISOString() };
      if (updatePrice) updatePayload.unit_price = txnUnitPrice;

      await sbUpdate("inventory", updatePayload, { id: `eq.${invItem.id}` });

      const txnId = await generateDailyTransactionId("GRN");
      await recordTransaction({
        transactionId: txnId,
        timestamp: new Date(receiptDate).toISOString(),
        type: "Goods Receipt",
        referenceNo: referenceNo || "Manual GRN",
        itemId: invItem.id,
        itemCode: invItem.code,
        itemName: invItem.name,
        quantityChange: qty,
        unit: invItem.unit,
        unitPrice: txnUnitPrice,
        valueChange: qty * txnUnitPrice,
        newStockQuantity: newQty,
        receivedBy: receivedBy,
        notes: notes || "",
        source: source
      });

      results.push({
        itemCode: item.itemCode,
        success: true,
        newStock: newQty,
        unitPriceUsed: txnUnitPrice,
        inventoryPriceUpdated: updatePrice
      });
    }

    if (hadError) {
      return { success: false, message: "Some items failed. No stock was changed for failed items.", details: results };
    }
    return { success: true, message: "Goods receipt processed successfully.", details: results };

  } catch (e: any) {
    console.error("processGoodsReceiptServer Error:", e);
    return { success: false, message: e.message, details: [] };
  }
}

function getGoodsReceiptTemplateHeaders() {
  return ["ItemCode", "QuantityReceived", "UnitPrice"];
}

async function recordTransaction(txDetails: any) {
  try {
    await sbInsert("transaction_logs", {
      transaction_id: txDetails.transactionId,
      timestamp: txDetails.timestamp,
      type: txDetails.type,
      reference_no: txDetails.referenceNo || null,
      item_id: txDetails.itemId ? parseInt(txDetails.itemId) : null,
      item_code: txDetails.itemCode,
      item_name: txDetails.itemName,
      quantity_change: txDetails.quantityChange,
      unit: txDetails.unit,
      unit_price: parseFloat(txDetails.unitPrice) || 0,
      value_change: parseFloat(txDetails.valueChange) || 0,
      new_stock_quantity: txDetails.newStockQuantity,
      received_by: txDetails.receivedBy,
      notes: txDetails.notes || "",
      source: txDetails.source
    });
    return { success: true };
  } catch (e: any) {
    console.error("recordTransaction Error:", e);
    return { success: false, message: e.message };
  }
}

// ============================================================
// DASHBOARD & REPORTS
// ============================================================

async function getDashboardSummary() {
  try {
    const totalItemsRows = await sbSelect("inventory", "id,quantity,min_quantity");
    const totalItems = totalItemsRows.length;
    const lowStockItems = totalItemsRows.filter((i: any) => {
      return i.quantity > 0 && i.quantity <= i.min_quantity;
    }).length;

    const reqSummary = await sbSelect("requisitions", "id,status,date");
    const pendingManagerApproval = reqSummary.filter((r: any) => r.status === "Pending Manager Approval").length;
    const pendingStockApproval = reqSummary.filter((r: any) => r.status === "Pending Stock Approval").length;
    const backorderedRequisitions = reqSummary.filter((r: any) => r.status === "Partially Completed").length;

    const txnRows = await sbSelect(
      "transaction_logs",
      "transaction_id,timestamp,type,reference_no,quantity_change,unit_price",
      { type: "eq.Requisition Issue" },
      "timestamp.asc"
    );

    const reqValueMap: Record<string, number> = {};
    txnRows.forEach((tx: any) => {
      const refNo = tx.reference_no;
      if (!refNo) return;
      const val = Math.abs(tx.quantity_change || 0) * (tx.unit_price || 0);
      reqValueMap[refNo] = (reqValueMap[refNo] || 0) + val;
    });

    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const labels: string[] = [];
    const requisitionCounts: number[] = [];
    const totalValues: number[] = [];
    const today = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const moStr = (mo + 1).toString().padStart(2, "0");

      labels.push(monthNames[mo] + " " + yr.toString().slice(-2));

      let count = 0;
      let value = 0;
      reqSummary.forEach((r: any) => {
        if (!r.date) return;
        const rd = new Date(r.date);
        if (rd.getFullYear() === yr && rd.getMonth() === mo) {
          count++;
          if (["Completed", "Partially Completed"].includes(r.status) && reqValueMap[r.id]) {
            value += reqValueMap[r.id];
          }
        }
      });

      requisitionCounts.push(count);
      totalValues.push(value);
    }

    return {
      totalItems: totalItems,
      lowStockItems: lowStockItems,
      pendingManagerApproval: pendingManagerApproval,
      pendingStockApproval: pendingStockApproval,
      backorderedRequisitions: backorderedRequisitions,
      monthlySummary: {
        labels: labels,
        requisitionCounts: requisitionCounts,
        totalValues: totalValues
      }
    };
  } catch (e: any) {
    console.error("getDashboardSummary Error:", e);
    return {
      error: e.message, totalItems: 0, lowStockItems: 0,
      pendingManagerApproval: 0, pendingStockApproval: 0, backorderedRequisitions: 0,
      monthlySummary: { labels: [], requisitionCounts: [], totalValues: [] }
    };
  }
}

async function getRequisitionsForExport(filters: any, username: string, role: string) {
  try {
    const requisitions = await getRequisitions(filters, username, role);
    if (!requisitions || requisitions.length === 0) return [];

    const reqIds = requisitions.map((r: any) => r.id);
    const allItems = await sbSelect("requisition_items", "*",
      { requisition_id: `in.(${reqIds.join(",")})` }
    );

    const allInv = await sbSelect("inventory", "id,code,location");
    const invMap: Record<string, any> = {};
    allInv.forEach((r: any) => { invMap[r.id.toString()] = r; });

    const flatData: any[] = [];
    requisitions.forEach((req: any) => {
      const items = allItems.filter((i: any) => i.requisition_id === req.id);

      let giLinksStr = "";
      if (Array.isArray(req.GoodsIssuePDFLinks)) {
        giLinksStr = req.GoodsIssuePDFLinks.map((l: any) => l.id + " (" + (l.url || l.path) + ")").join("; ");
      }

      if (items.length === 0) {
        flatData.push(_buildExportRow(req, null, null, giLinksStr));
      } else {
        items.forEach((item: any) => {
          flatData.push(_buildExportRow(req, item, invMap[item.item_id ? item.item_id.toString() : ""], giLinksStr));
        });
      }
    });

    return flatData;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

function _buildExportRow(req: any, item: any, inv: any, giLinksStr: string) {
  const base = {
    "เลขที่ใบเบิก": req.id,
    "วันที่เบิก": req.date || "",
    "วัตถุประสงค์": req.purpose,
    "Username ผู้เบิก": req.requestedBy,
    "ชื่อผู้เบิก": req.requestorName,
    "แผนกผู้เบิก": req.requestorDepartment,
    "สถานะใบเบิก": req.status,
    "ผู้อนุมัติ (Username)": req.managerApproverUsername || "",
    "ผู้อนุมัติ (ชื่อ)": req.managerApproverName || "",
    "สถานะการอนุมัติ": req.managerApprovalStatus || "",
    "วันที่อนุมัติ": req.managerApprovalDate || "",
    "หมายเหตุการอนุมัติ": req.managerApprovalNote || "",
    "ผู้จ่ายของ (Username)": req.stockApproverUsername || "",
    "ผู้จ่ายของ (ชื่อ)": req.stockApproverName || "",
    "สถานะการจ่าย": req.stockApprovalStatus || "",
    "วันที่จ่าย": req.stockApprovalDate || "",
    "หมายเหตุการจ่าย": req.stockApprovalNote || "",
    "ลิงก์ใบเบิก": req.RequisitionPDFLink || "",
    "ลิงก์ใบจ่าย": giLinksStr || "",
    "วันที่สร้างใบเบิก": req.createdAt || "",
    "วันที่อัปเดตใบเบิก": req.updatedAt || ""
  };

  if (!item) {
    return Object.assign(base, {
      "รหัสวัสดุ (Inv. ID)": "ไม่มีรายการ",
      "รหัสวัสดุ (Code)": "", "ชื่อวัสดุ": "", "ที่ตั้ง": "",
      "จำนวนขอเบิก": "", "จำนวนจ่ายจริง (สะสม)": "",
      "ค้างจ่าย": "", "หมายเหตุรายการ": "", "หน่วยนับ": "",
      "ราคาต่อหน่วย": "", "มูลค่ารวม": ""
    });
  }

  return Object.assign(base, {
    "รหัสวัสดุ (Inv. ID)": item.item_id,
    "รหัสวัสดุ (Code)": inv ? inv.code : "N/A",
    "ชื่อวัสดุ": item.item_name,
    "ที่ตั้ง": inv ? (inv.location || "N/A") : "N/A",
    "จำนวนขอเบิก": item.quantity,
    "จำนวนจ่ายจริง (สะสม)": item.dispensed_quantity,
    "ค้างจ่าย": item.is_backordered ? "ใช่" : "ไม่",
    "หมายเหตุรายการ": item.notes_for_item || "",
    "หน่วยนับ": item.unit,
    "ราคาต่อหน่วย": item.unit_price,
    "มูลค่ารวม": item.total_price
  });
}

async function getApprovedIssuedReport(filters: any) {
  filters = filters || {};
  try {
    const params: any = {
      select: "*",
      status: "in.(Completed,Partially Completed)"
    };
    _applyDateFiltersToParams(params, filters);
    if (filters.department && filters.department.trim()) {
      params.requestor_department = `ilike.%${filters.department}%`;
    }

    let reqs = await sbSelect("requisitions", "*", params, "date.desc");

    reqs = _filterReqsByDateOnlyRange(reqs, filters);

    const reqIds = reqs.map((r: any) => r.id);
    if (reqIds.length === 0) return [];

    const items = await sbSelect("requisition_items", "*",
      { requisition_id: `in.(${reqIds.join(",")})`, dispensed_quantity: "gt.0" }
    );

    const invMap = await _buildInventoryMap(items.map((i: any) => i.item_id));
    const data: any[] = [];

    reqs.forEach((req: any) => {
      items.filter((i: any) => i.requisition_id === req.id).forEach((item: any) => {
        const inv = invMap[item.item_id] || {};
        data.push({
          requisitionId: req.id,
          requisitionDate: req.date,
          department: req.requestor_department,
          requestorName: req.requestor_name,
          itemCode: inv.code || "N/A",
          itemName: item.item_name,
          dispensedQuantity: item.dispensed_quantity,
          unit: item.unit,
          unitPrice: item.unit_price,
          totalValue: item.total_price,
          approvedBy: req.manager_approver_name || "N/A",
          status: req.status
        });
      });
    });
    return data;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function getCancelledRejectedReport(filters: any) {
  filters = filters || {};
  try {
    const params: any = {
      select: "*",
      status: "in.(Rejected by Stock,Rejected by Manager)"
    };
    _applyDateFiltersToParams(params, filters);
    if (filters.department && filters.department.trim()) {
      params.requestor_department = `ilike.%${filters.department}%`;
    }

    let reqs = await sbSelect("requisitions", "*", params, "date.desc");

    reqs = _filterReqsByDateOnlyRange(reqs, filters);

    const reqIds = reqs.map((r: any) => r.id);
    const items = reqIds.length > 0
      ? await sbSelect("requisition_items", "*", { requisition_id: `in.(${reqIds.join(",")})` })
      : [];
    const invMap = await _buildInventoryMap(items.map((i: any) => i.item_id));

    const data: any[] = [];
    reqs.forEach((req: any) => {
      const reqItems = items.filter((i: any) => i.requisition_id === req.id);
      const rejectedBy = req.status === "Rejected by Manager" ? req.manager_approver_name : req.stock_approver_name;

      if (reqItems.length === 0) {
        data.push({
          requisitionId: req.id, requisitionDate: req.date,
          department: req.requestor_department, requestorName: req.requestor_name,
          itemCode: "N/A", itemName: "N/A (ใบเบิกถูกปฏิเสธทั้งหมด)",
          requestedQuantity: "N/A", unit: "N/A",
          reason: req.manager_approval_note || req.stock_approval_note || "N/A",
          rejectedBy: rejectedBy, status: req.status
        });
      } else {
        reqItems.forEach((item: any) => {
          const inv = invMap[item.item_id] || {};
          data.push({
            requisitionId: req.id, requisitionDate: req.date,
            department: req.requestor_department, requestorName: req.requestor_name,
            itemCode: inv.code || "N/A", itemName: item.item_name,
            requestedQuantity: item.quantity, unit: item.unit,
            reason: item.notes_for_item || req.manager_approval_note || req.stock_approval_note || "N/A",
            rejectedBy: rejectedBy, status: req.status
          });
        });
      }
    });
    return data;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function getPotentialOverStockReport(filters: any) {
  filters = filters || {};
  try {
    const params: any = {
      select: "*",
      status: "in.(Pending Stock Approval,Pending Manager Approval)"
    };
    _applyDateFiltersToParams(params, filters);
    if (filters.department && filters.department.trim()) {
      params.requestor_department = `ilike.%${filters.department}%`;
    }

    let reqs = await sbSelect("requisitions", "*", params, "date.desc");

    reqs = _filterReqsByDateOnlyRange(reqs, filters);

    const reqIds = reqs.map((r: any) => r.id);
    const items = reqIds.length > 0
      ? await sbSelect("requisition_items", "*", { requisition_id: `in.(${reqIds.join(",")})` })
      : [];
    const invMap = await _buildInventoryMap(items.map((i: any) => i.item_id), true);

    const data: any[] = [];
    reqs.forEach((req: any) => {
      items.filter((i: any) => i.requisition_id === req.id).forEach((item: any) => {
        const inv = invMap[item.item_id] || {};
        const currentStock = inv.quantity !== undefined ? inv.quantity : 0;
        const requested = item.quantity || 0;
        if (requested > currentStock) {
          data.push({
            requisitionId: req.id,
            requisitionDate: req.date,
            department: req.requestor_department,
            requestorName: req.requestor_name,
            itemCode: inv.code || "N/A",
            itemName: item.item_name,
            requestedQuantity: requested,
            currentStock: currentStock,
            unit: item.unit,
            status: req.status
          });
        }
      });
    });
    return data;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function getBackorderedItemsReport(filters: any) {
  filters = filters || {};
  try {
    const params: any = { select: "*", status: "in.(Partially Completed,Completed)" };
    _applyDateFiltersToParams(params, filters);
    if (filters.department && filters.department.trim()) {
      params.requestor_department = `ilike.%${filters.department}%`;
    }

    let reqs = await sbSelect("requisitions", "*", params, "date.desc");

    reqs = _filterReqsByDateOnlyRange(reqs, filters);

    const reqIds = reqs.map((r: any) => r.id);
    const items = reqIds.length > 0
      ? await sbSelect("requisition_items", "*",
        { requisition_id: `in.(${reqIds.join(",")})`, is_backordered: "eq.true" }
      )
      : [];
    const invMap = await _buildInventoryMap(items.map((i: any) => i.item_id));

    const data: any[] = [];
    items.forEach((item: any) => {
      const req = reqs.find((r: any) => r.id === item.requisition_id);
      if (!req) return;
      const inv = invMap[item.item_id] || {};
      const backorderedQty = (item.quantity || 0) - (item.dispensed_quantity || 0);
      if (backorderedQty > 0 && item.is_backordered) {
        data.push({
          requisitionId: req.id,
          requisitionDate: req.date,
          department: req.requestor_department,
          requestorName: req.requestor_name,
          itemCode: inv.code || "N/A",
          itemName: item.item_name,
          backorderedQuantity: backorderedQty,
          unit: item.unit,
          itemNote: item.notes_for_item || "",
          requisitionStatus: req.status
        });
      }
    });
    return data;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function getFulfilledBackordersReport(filters: any) {
  filters = filters || {};
  try {
    const params = {
      select: "*",
      type: "eq.Requisition Issue"
    };
    let txns = (await sbSelect("transaction_logs", "*", params, "timestamp.desc"))
      .filter((log: any) => {
        return log.notes && log.notes.toLowerCase().includes("(backorder fulfillment)");
      });

    const sd = filters.startDate;
    const ed = filters.endDate;
    txns = txns.filter((t: any) => {
      if (!t.timestamp) return false;
      const ictDate = new Date(t.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
      if (sd && ictDate < sd) return false;
      if (ed && ictDate > ed) return false;
      return true;
    });

    const refNos = txns.map((t: any) => t.reference_no).filter(Boolean);
    const reqs = refNos.length > 0
      ? await sbSelect("requisitions", "id,requestor_department,requestor_name,status",
        { id: `in.(${refNos.join(",")})` }
      )
      : [];
    const reqMap: Record<string, any> = {};
    reqs.forEach((r: any) => { reqMap[r.id] = r; });

    const data: any[] = [];
    txns.forEach((log: any) => {
      const req = reqMap[log.reference_no];
      if (!req) return;
      if (filters.department && filters.department.trim()) {
        if (!req.requestor_department ||
          !req.requestor_department.toLowerCase().includes(filters.department.toLowerCase())) {
          return;
        }
      }
      data.push({
        requisitionId: req.id,
        fulfillmentDate: log.timestamp ? new Date(log.timestamp).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }) : "",
        department: req.requestor_department,
        requestorName: req.requestor_name,
        itemCode: log.item_code,
        itemName: log.item_name,
        fulfilledQuantity: Math.abs(log.quantity_change || 0),
        unit: log.unit,
        fulfilledBy: log.received_by,
        itemNote: log.notes,
        requisitionStatus: req.status
      });
    });
    return data;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function getInventoryStockReport(filters: any) {
  filters = filters || {};
  try {
    const params: any = {};
    if (filters.category && filters.category.trim()) {
      params.category = `ilike.%${filters.category}%`;
    }
    if (filters.location && filters.location.trim()) {
      params.location = `ilike.%${filters.location}%`;
    }

    const items = await sbSelect(
      "inventory",
      "id,code,name,category,location,unit,quantity,min_quantity,unit_price,updated_at",
      params,
      "name.asc"
    );

    return items.map((item: any) => {
      const qty = item.quantity || 0;
      const price = item.unit_price || 0;
      return {
        "ID": item.id,
        "รหัส": item.code,
        "ชื่อวัสดุ": item.name,
        "หมวดหมู่": item.category || "N/A",
        "ที่ตั้ง": item.location || "N/A",
        "หน่วย": item.unit || "N/A",
        "คงเหลือ": qty,
        "Min Stock": item.min_quantity || 0,
        "ราคา/หน่วย": price,
        "มูลค่ารวม": qty * price,
        "อัปเดตล่าสุด": item.updated_at || "N/A"
      };
    });
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

async function getDailyRequisitionReport(filters: any) {
  filters = filters || {};
  try {
    const selectedDate = filters.reportDate;
    const startDate = filters.startDate || selectedDate;
    const endDate = filters.endDate || selectedDate;

    if (!startDate) throw new Error("No report date or date range specified");

    const params: any = {
      select: "*"
    };
    if (selectedDate && !filters.startDate && !filters.endDate) {
      params.date = `eq.${selectedDate}`;
    } else {
      _applyDateFiltersToParams(params, { startDate, endDate });
    }

    if (filters.department && filters.department.trim()) {
      params.requestor_department = `ilike.%${filters.department}%`;
    }

    let reqs = await sbSelect("requisitions", "*", params, "created_at.asc");

    // Apply accurate timezone-aware date range and time-interval filtering
    reqs = _filterReqsByDateTimeRange(reqs, {
      startDate,
      endDate,
      startTime: filters.startTime,
      endTime: filters.endTime
    });

    const reqIds = reqs.map((r: any) => r.id);
    if (reqIds.length === 0) return [];

    const items = await sbSelect("requisition_items", "*",
      { requisition_id: `in.(${reqIds.join(",")})` }
    );

    const invMap = await _buildInventoryMap(items.map((i: any) => i.item_id));
    const data: any[] = [];

    reqs.forEach((req: any) => {
      const creationTime = req.created_at ? new Date(req.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "";
      const reqItems = items.filter((i: any) => i.requisition_id === req.id);
      if (reqItems.length === 0) {
        data.push({
          requisitionId: req.id,
          creationTime: creationTime,
          department: req.requestor_department,
          requestorName: req.requestor_name,
          itemCode: "N/A",
          itemName: "N/A (Empty)",
          requestedQuantity: 0,
          dispensedQuantity: 0,
          itemIsBackordered: "No",
          status: req.status
        });
      } else {
        reqItems.forEach((item: any) => {
          const inv = invMap[item.item_id] || {};
          data.push({
            requisitionId: req.id,
            creationTime: creationTime,
            department: req.requestor_department,
            requestorName: req.requestor_name,
            itemCode: inv.code || "N/A",
            itemName: item.item_name,
            requestedQuantity: item.quantity,
            dispensedQuantity: item.dispensed_quantity,
            itemIsBackordered: item.is_backordered ? "Yes" : "No",
            status: req.status
          });
        });
      }
    });

    return data;
  } catch (e: any) {
    return { error: true, message: e.message };
  }
}

// ─── UTILITY REPORT HELPERS ─────────────────────────────────────────

async function _buildInventoryMap(itemIds: number[], includeQty = false) {
  if (!itemIds || itemIds.length === 0) return {};
  const uniqueIds = itemIds.filter((id, idx, arr) => arr.indexOf(id) === idx);
  const select = includeQty
    ? "id,code,location,quantity,unit_price"
    : "id,code,location";
  const rows = await sbSelect("inventory", select, { id: `in.(${uniqueIds.join(",")})` });
  const map: Record<string, any> = {};
  rows.forEach((r: any) => { map[r.id.toString()] = r; });
  return map;
}

function _applyDateFiltersToParams(params: any, filters: any) {
  if (filters.startDate && !filters.endDate) {
    params.date = `gte.${filters.startDate}`;
  } else if (!filters.startDate && filters.endDate) {
    params.date = `lte.${filters.endDate}`;
  }
}

function _filterReqsByDateOnlyRange(reqs: any[], filters: any) {
  return _filterReqsByDateTimeRange(reqs, filters);
}

function _filterReqsByDateTimeRange(reqs: any[], filters: any) {
  const sd = filters.startDate;
  const ed = filters.endDate;
  if (!sd && !ed) return reqs;

  const startTimeStr = filters.startTime || "00:00";
  const endTimeStr = filters.endTime || "23:59";

  const startTarget = `${sd || "1970-01-01"} ${startTimeStr}:00`;
  const endTarget = `${ed || "9999-12-31"} ${endTimeStr}:59`;

  return reqs.filter((r: any) => {
    let timestampStr = r.created_at || r.createdAt;
    if (timestampStr) {
      try {
        const ictStr = new Date(timestampStr).toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" });
        const ictDateOnly = ictStr.split(" ")[0];
        const ictTimeOnly = ictStr.split(" ")[1].substring(0, 5);

        if (sd && ictDateOnly < sd) return false;
        if (ed && ictDateOnly > ed) return false;

        if (sd && ictDateOnly === sd && ictTimeOnly < startTimeStr) return false;
        if (ed && ictDateOnly === ed && ictTimeOnly > endTimeStr) return false;

        return true;
      } catch (err) {
        // Fallback to simple date only comparison on error
      }
    }

    if (!r.date) return false;
    if (sd && r.date < sd) return false;
    if (ed && r.date > ed) return false;
    return true;
  });
}

// ============================================================
// PDF HTML GENERATOR WITH SAFE DATE FORMATTING HELPERS
// ============================================================

function safeLocaleDateString(dateVal: any, locale = "th-TH", options: Intl.DateTimeFormatOptions = {}) {
  try {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString(locale, options);
  } catch (err) {
    return String(dateVal);
  }
}

function safeLocaleString(dateVal: any, locale = "th-TH", options: Intl.DateTimeFormatOptions = {}) {
  try {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleString(locale, options);
  } catch (err) {
    return String(dateVal);
  }
}

async function generateRequisitionFormPDF(requisitionId: string, requisition: any, items: any[], grandTotal: number) {
  try {
    const htmlContent = _buildRequisitionFormHtml("ใบเบิกวัสดุ", requisition, items, grandTotal);
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    const htmlBuffer = Buffer.from(htmlContent, "utf-8");
    const buffer = Buffer.concat([bom, htmlBuffer]);
    const filePath = `requisitions/${requisitionId}_${new Date().toISOString().slice(0, 10)}.html`;
    await sbUploadFile("pdfs", filePath, buffer, "text/html");
    return filePath;
  } catch (e) {
    console.error("generateRequisitionFormPDF Error:", e);
    return null;
  }
}

async function generateGoodsIssuePDF(requisitionHeaderData: any, itemsForThisGI: any[], pdfTitle: string) {
  try {
    const htmlContent = _buildGoodsIssueHtml(pdfTitle, requisitionHeaderData, itemsForThisGI);
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    const htmlBuffer = Buffer.from(htmlContent, "utf-8");
    const buffer = Buffer.concat([bom, htmlBuffer]);
    const filePath = `goods-issue/${requisitionHeaderData.goodsIssueId}.html`;
    await sbUploadFile("pdfs", filePath, buffer, "text/html");
    return filePath;
  } catch (e) {
    console.error("generateGoodsIssuePDF Error:", e);
    return null;
  }
}

async function updateRequisitionPdf(requisitionId: string) {
  try {
    const req = await sbSelectOne("requisitions", "*", { id: `eq.${requisitionId}` });
    if (!req) return null;
    const mappedReqForPdf = {
      id: req.id,
      date: req.date,
      purpose: req.purpose,
      requestedBy: req.requested_by,
      requestorName: req.requestor_name,
      requestorDepartment: req.requestor_department,
      status: req.status,
      managerApproverUsername: req.manager_approver_username,
      managerApproverName: req.manager_approver_name,
      managerApprovalStatus: req.manager_approval_status,
      managerApprovalDate: req.manager_approval_date,
      managerApprovalNote: req.manager_approval_note,
      stockApproverUsername: req.stock_approver_username,
      stockApproverName: req.stock_approver_name,
      stockApprovalStatus: req.stock_approval_status,
      stockApprovalDate: req.stock_approval_date,
      stockApprovalNote: req.stock_approval_note,
      createdAt: req.created_at,
      updatedAt: req.updated_at
    };
    const allItemsForPdf = await sbSelect("requisition_items", "*", { requisition_id: `eq.${requisitionId}` });
    const itemIds = allItemsForPdf.map((item: any) => item.item_id).filter(Boolean);
    const invRows = itemIds.length > 0 ? await sbSelect("inventory", "id,code,location", { id: `in.(${itemIds.join(",")})` }) : [];
    const invMap: Record<string, any> = {};
    invRows.forEach((r: any) => { invMap[r.id.toString()] = r; });

    const itemsForPdf = allItemsForPdf.map((item: any) => {
      const up = parseFloat(item.unit_price) || 0;
      const qty = parseInt(item.quantity) || 0;
      const inv = invMap[item.item_id?.toString()] || {};
      return {
        itemId: item.item_id,
        itemName: item.item_name,
        quantity: qty,
        unit: item.unit,
        itemCode: inv.code || "N/A",
        location: inv.location || "N/A",
        UnitPrice: up,
        TotalPrice: qty * up,
        dispensedQuantity: item.dispensed_quantity || 0,
        isBackordered: item.is_backordered || false,
        notesForItem: item.notes_for_item || "",
      };
    });
    const pdfGrandTotal = itemsForPdf.reduce((sum, item) => sum + (item.TotalPrice || 0), 0);
    const updatedPdfPath = await generateRequisitionFormPDF(requisitionId, mappedReqForPdf, itemsForPdf, pdfGrandTotal);
    if (updatedPdfPath) {
      await sbUpdate("requisitions", { requisition_pdf_path: updatedPdfPath }, { id: `eq.${requisitionId}` });
    }
    return updatedPdfPath;
  } catch (err: any) {
    console.error("updateRequisitionPdf failed:", err);
    return null;
  }
}

function _buildRequisitionFormHtml(pdfTitle: string, requisition: any, items: any[], grandTotal: number) {
  const rows = items.map((item, i) => {
    const up = parseFloat(item.UnitPrice) || 0;
    const qty = parseInt(item.quantity) || 0;
    return `<tr>
      <td>${i + 1}</td>
      <td>${item.itemCode || "-"}</td>
      <td style='text-align:left'>${item.itemName}</td>
      <td>${item.location || "-"}</td>
      <td>${qty}</td>
      <td>${item.unit}</td>
      <td class='currency'>${up.toFixed(2)}</td>
      <td class='currency'>${(qty * up).toFixed(2)}</td>
    </tr>`;
  }).join("");

  const createdDate = requisition.createdAt
    ? safeLocaleString(requisition.createdAt, "th-TH", { dateStyle: "short", timeStyle: "short" })
    : "...";

  const managerDateLabel = requisition.managerApprovalDate
    ? safeLocaleDateString(requisition.managerApprovalDate, "th-TH")
    : ".........................";

  const stockDateLabel = requisition.stockApprovalDate
    ? safeLocaleDateString(requisition.stockApprovalDate, "th-TH")
    : ".........................";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>${_pdfBaseStyle()}</style></head><body>
    <div class='header'>${pdfTitle}</div>
    <div class='subheader'>เลขที่อ้างอิง: ${requisition.id} (สถานะ: ${requisition.status})</div>
    
    <table class="info-table">
      <tr>
        <td style="width: 50%;"><strong>วันที่เบิก:</strong> ${safeLocaleDateString(requisition.date, "th-TH", { year: "numeric", month: "long", day: "numeric" })}</td>
        <td style="width: 50%;"><strong>ผู้เบิก:</strong> ${(requisition.requestorName || "")}</td>
      </tr>
      <tr>
        <td style="width: 50%;"><strong>หน่วยงาน:</strong> ${(requisition.requestorDepartment || "")}</td>
        <td style="width: 50%;"><strong>วัตถุประสงค์:</strong> ${(requisition.purpose || "")}</td>
      </tr>
    </table>

    <table class='item-table'><thead><tr>
      <th style='width:5%'>ลำดับ</th><th style='width:12%'>รหัสวัสดุ</th>
      <th style='width:33%'>ชื่อวัสดุ</th><th style='width:10%'>ที่ตั้ง</th>
      <th style='width:10%'>จำนวนเบิก</th><th style='width:8%'>หน่วย</th>
      <th style='width:10%' class='currency'>ราคา/หน่วย</th><th style='width:12%' class='currency'>มูลค่ารวม</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr class='total-row'>
      <td colspan='7' style='text-align:right;padding-right:10px'>รวมมูลค่าที่ขอเบิก (บาท):</td>
      <td class='currency'>${grandTotal.toFixed(2)}</td>
    </tr></tfoot></table>

    <table class="signature-table">
      <tr>
        <td style="width: 33.33%;">
          <div style="margin-bottom: 35px; color: #777;">............................................................</div>
          <div style="margin-bottom: 5px;">(${(requisition.requestorName || "ผู้ขอเบิก")})</div>
          <strong style="display: block; margin-bottom: 5px; color: #111;">ผู้ขอเบิก</strong>
          <div style="font-size: 8.5pt; color: #555;">วันที่: ${createdDate}</div>
        </td>
        <td style="width: 33.33%;">
          <div style="margin-bottom: 35px; color: #777;">............................................................</div>
          <div style="margin-bottom: 5px;">(${(requisition.managerApproverName || "........................................")})</div>
          <strong style="display: block; margin-bottom: 5px; color: #111;">ผู้อนุมัติ (หัวหน้างาน/ผอ.)</strong>
          <div style="margin-bottom: 4px; font-size: 8.5pt; color: #444;">สถานะ: ${(requisition.managerApprovalStatus || "-")}</div>
          <div style="font-size: 8.5pt; color: #555;">วันที่อนุมัติ: ${managerDateLabel}</div>
        </td>
        <td style="width: 33.33%;">
          <div style="margin-bottom: 35px; color: #777;">............................................................</div>
          <div style="margin-bottom: 5px;">(${(requisition.stockApproverName || "........................................")})</div>
          <strong style="display: block; margin-bottom: 5px; color: #111;">เจ้าหน้าที่พัสดุ (ผู้จ่าย)</strong>
          <div style="margin-bottom: 4px; font-size: 8.5pt; color: #444;">สถานะ: ${(requisition.stockApprovalStatus || "-")}</div>
          <div style="font-size: 8.5pt; color: #555;">วันที่อนุมัติ: ${stockDateLabel}</div>
        </td>
      </tr>
    </table>

    <div class='footer-note'>เอกสารนี้สร้างจากระบบ THAMC e-Material เมื่อ ${safeLocaleString(new Date(), "th-TH", { dateStyle: "medium", timeStyle: "short" })}</div>
    </body></html>`;
}

function _buildGoodsIssueHtml(pdfTitle: string, reqHeader: any, items: any[]) {
  let grandTotal = 0;
  const rows = items.map((item, i) => {
    const up = parseFloat(item.UnitPrice) || 0;
    const qtyDisp = parseInt(item.dispensedQuantity) || 0;
    grandTotal += qtyDisp * up;
    const dispDisplay = qtyDisp > 0 ? qtyDisp
      : (item.isBackordered ? "<span style='color:red;font-style:italic'>ค้างจ่าย</span>" : "0");
    return `<tr>
      <td>${i + 1}</td>
      <td>${item.itemCode || "-"}<br><small style='color:#555'>(${item.location || "N/A"})</small></td>
      <td style='text-align:left'>${item.itemName}${item.notesForItem ? `<br><small>หมายเหตุ: ${item.notesForItem}</small>` : ""}</td>
      <td>${item.quantity || 0}</td>
      <td>${dispDisplay}</td>
      <td>${item.unit}</td>
      <td class='currency'>${up.toFixed(2)}</td>
      <td class='currency'>${(qtyDisp * up).toFixed(2)}</td>
      <td>${item.currentInventoryQuantity >= 0 ? item.currentInventoryQuantity : 0}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>${_pdfBaseStyle()}</style></head><body>
    <div class='header'>${pdfTitle}</div>
    <div class='subheader'>เลขที่ใบจ่าย: ${reqHeader.goodsIssueId} (สถานะใบเบิกหลัก: ${reqHeader.status})</div>
    <div class='subheader' style='text-align:right;font-size:9pt'>อ้างอิงใบเบิกเลขที่: ${reqHeader.id}</div>
    
    <table class="info-table">
      <tr>
        <td style="width: 50%;"><strong>วันที่เบิก:</strong> ${safeLocaleDateString(reqHeader.date, "th-TH", { year: "numeric", month: "long", day: "numeric" })}</td>
        <td style="width: 50%;"><strong>วันที่จ่าย:</strong> ${safeLocaleDateString(new Date(), "th-TH", { year: "numeric", month: "long", day: "numeric" })}</td>
      </tr>
      <tr>
        <td style="width: 50%;"><strong>ผู้เบิก:</strong> ${(reqHeader.requestorName || "")}</td>
        <td style="width: 50%;"><strong>หน่วยงาน:</strong> ${(reqHeader.requestorDepartment || "")}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>วัตถุประสงค์:</strong> ${(reqHeader.purpose || "")}</td>
      </tr>
    </table>

    <table class='item-table'><thead><tr>
      <th style='width:5%'>ลำดับ</th><th style='width:12%'>รหัส/ที่ตั้ง</th>
      <th style='width:24%'>ชื่อวัสดุ</th><th style='width:8%'>ขอเบิก</th>
      <th style='width:8%'>จ่ายครั้งนี้</th><th style='width:7%'>หน่วย</th>
      <th style='width:10%' class='currency'>ราคา/หน่วย</th>
      <th style='width:14%' class='currency'>มูลค่า</th><th style='width:12%'>คงเหลือ</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr class='total-row'>
      <td colspan='7' style='text-align:right;padding-right:10px'>รวมมูลค่าที่จ่ายครั้งนี้ (บาท):</td>
      <td class='currency'>${grandTotal.toFixed(2)}</td><td></td>
    </tr></tfoot></table>

    <table class="signature-table">
      <tr>
        <td style="width: 50%;">
          <div style="margin-bottom: 35px; color: #777;">............................................................</div>
          <div style="margin-bottom: 5px;">(${(reqHeader.requestorName || "ผู้รับของ")})</div>
          <strong style="display: block; margin-bottom: 5px; color: #111;">ผู้รับของ</strong>
          <div style="font-size: 8.5pt; color: #555;">วันที่: ${safeLocaleDateString(new Date(), "th-TH")}</div>
        </td>
        <td style="width: 50%;">
          <div style="margin-bottom: 35px; color: #777;">............................................................</div>
          <div style="margin-bottom: 5px;">(${(reqHeader.stockApproverName || "ผู้จ่ายของ")})</div>
          <strong style="display: block; margin-bottom: 5px; color: #111;">ผู้จ่ายของ</strong>
          <div style="font-size: 8.5pt; color: #555;">วันที่: ${safeLocaleDateString(new Date(), "th-TH")}</div>
        </td>
      </tr>
    </table>

    <div class='footer-note'>เอกสารนี้สร้างจากระบบ THAMC e-Material เมื่อ ${safeLocaleString(new Date(), "th-TH", { dateStyle: "medium", timeStyle: "short" })}</div>
    </body></html>`;
}

function _pdfBaseStyle() {
  return `@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
    body{font-family:'Sarabun',sans-serif;font-size:10pt;margin:20px;color:#111}
    table{width:100%;border-collapse:collapse;margin-bottom:15px;page-break-inside:auto}
    .item-table{width:100%;border-collapse:collapse;margin-bottom:15px}
    .item-table th, .item-table td{border:1px solid black;padding:6px;text-align:left;word-wrap:break-word;font-size:10pt}
    .item-table th{background:#f0f0f0;font-weight:bold;text-align:center}
    .header{text-align:center;font-size:14pt;font-weight:bold;margin-bottom:10px;color:#000}
    .subheader{text-align:center;font-size:10pt;margin-bottom:8px;color:#333}
    .info-table{width:100%;margin-bottom:15px;font-size:10pt;line-height:1.6;border-collapse:collapse;border:none !important}
    .info-table td{border:none !important;padding:4px 0 !important;text-align:left !important;background:transparent !important}
    .currency{text-align:right;padding-right:5px}
    .total-row td{font-weight:bold;background:#f0f0f0 !important;border:1px solid black !important}
    .signature-table{width:100%;margin-top:40px;page-break-inside:avoid;line-height:1.6;border-collapse:collapse;border:none !important}
    .signature-table td{border:none !important;text-align:center !important;vertical-align:top;padding:10px !important;background:transparent !important}
    .footer-note{font-size:8pt;text-align:center;margin-top:30px;color:#666}
    .item-table td:nth-child(1),.item-table td:nth-child(4),.item-table td:nth-child(5){text-align:center}`;
}

// ============================================================
// SYSTEM MAPPING & TRANSFORMATION HELPERS
// ============================================================

async function _mapRequisitionRow(row: any) {
  let pdfPath = row.requisition_pdf_path;
  if (!pdfPath) {
    try {
      pdfPath = await updateRequisitionPdf(row.id);
    } catch (err) {
      console.error(`Auto-regenerating missing PDF for ${row.id} failed:`, err);
    }
  }

  return {
    id: row.id,
    date: row.date,
    purpose: row.purpose,
    requestedBy: row.requested_by,
    requestorName: row.requestor_name,
    requestorDepartment: row.requestor_department,
    status: row.status,
    managerApproverUsername: row.manager_approver_username,
    managerApproverName: row.manager_approver_name,
    managerApprovalStatus: row.manager_approval_status,
    managerApprovalDate: row.manager_approval_date,
    managerApprovalNote: row.manager_approval_note,
    stockApproverUsername: row.stock_approver_username,
    stockApproverName: row.stock_approver_name,
    stockApprovalStatus: row.stock_approval_status,
    stockApprovalDate: row.stock_approval_date,
    stockApprovalNote: row.stock_approval_note,
    RequisitionPDFLink: pdfPath
      ? `/api/view-document?bucket=pdfs&path=${encodeURIComponent(pdfPath)}`
      : null,
    GoodsIssuePDFLinks: await _resolveGiPdfLinks(row.goods_issue_pdf_links),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function _resolveGiPdfLinks(linksJson: any) {
  if (!linksJson) return [];
  const links = typeof linksJson === "string" ? JSON.parse(linksJson) : linksJson;
  return links.map((link: any) => {
    return Object.assign({}, link, {
      url: link.path ? `/api/view-document?bucket=pdfs&path=${encodeURIComponent(link.path)}` : link.url
    });
  });
}

function _mapItemRow(item: any, inventoryMap: Record<string, any>) {
  const inv = inventoryMap[item.item_id] || {};
  return {
    requisitionId: item.requisition_id,
    itemId: item.item_id.toString(),
    itemName: item.item_name,
    quantity: item.quantity,
    unit: item.unit,
    dispensedQuantity: item.dispensed_quantity,
    UnitPrice: item.unit_price,
    TotalPrice: item.total_price || (item.quantity * item.unit_price),
    isBackordered: item.is_backordered,
    notesForItem: item.notes_for_item || "",
    itemCode: inv.code || "N/A",
    location: inv.location || "N/A",
    currentInventoryQuantity: inv.quantity !== undefined ? inv.quantity : 0,
    imageUrl: inv.imageUrl || null
  };
}

// ============================================================
// API HUB ROUTING (RPC ENGINE)
// ============================================================
const functionsMap: Record<string, (...args: any[]) => Promise<any>> = {
  getDepartments,
  registerUser,
  loginUser,
  updateUserProfile,
  getAllUsers,
  updateUserByAdmin,
  deleteUserByAdmin,
  getInventoryItems,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  updateInventoryQuantities,
  uploadInventoryImage,
  deleteInventoryImage,
  createRequisition,
  getRequisitions,
  getRequisitionDetails,
  getPendingApprovals,
  getRequisitionsForBatchApproval,
  processBatchApproval,
  processBatchApprovalByItem,
  approveRequisition,
  manuallyCompleteRequisition,
  processGoodsReceiptServer,
  getGoodsReceiptTemplateHeaders: async () => getGoodsReceiptTemplateHeaders(),
  recordTransaction,
  getDashboardSummary,
  getRequisitionsForExport,
  getApprovedIssuedReport,
  getCancelledRejectedReport,
  getPotentialOverStockReport,
  getBackorderedItemsReport,
  getFulfilledBackordersReport,
  getInventoryStockReport,
  getDailyRequisitionReport
};

app.get("/api/view-document", async (req, res) => {
  const { bucket, path: filePath, download } = req.query;
  if (!bucket || !filePath) {
    return res.status(400).send("Parameters 'bucket' and 'path' are required");
  }

  try {
    const signedUrl = await sbGetSignedUrl(String(bucket), String(filePath));
    if (!signedUrl) {
      return res.status(404).send("Document not found (failed to create signed url)");
    }

    const response = await fetch(signedUrl);

    if (response.status !== 200) {
      return res.status(response.status).send(`Failed to load document: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const htmlText = Buffer.from(buffer).toString("utf-8");

    // Handle direct download if requested
    if (download === "true") {
      const filename = String(filePath).split("/").pop() || "document.html";
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(htmlText);
    }

    let finalHtml = htmlText;

    // Inject styles and bar after <body> or <body ...>
    const bodyMatch = finalHtml.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const bodyIndex = finalHtml.indexOf(bodyMatch[0]) + bodyMatch[0].length;
      
      const injectStyle = `
<style>
  @media print {
    .print-header-bar {
      display: none !important;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
    }
  }
  .print-header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    color: #ffffff;
    padding: 12px 20px;
    font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border-bottom: 2px solid #1e293b;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
    border-radius: 6px;
  }
  .print-header-bar .title {
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .print-header-bar .actions {
    display: flex;
    gap: 12px;
  }
  .print-header-bar button, .print-header-bar a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #3b82f6;
    color: #ffffff;
    border: none;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }
  .print-header-bar button:hover, .print-header-bar a:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }
  .print-header-bar .btn-print {
    background: #10b981;
  }
  .print-header-bar .btn-print:hover {
    background: #059669;
  }
  .print-header-bar .btn-pdf {
    background: #ef4444;
  }
  .print-header-bar .btn-pdf:hover {
    background: #dc2626;
  }
  @keyframes spin {
    100% { transform: rotate(360deg); }
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<script>
  async function downloadAsPDF() {
    const btn = document.getElementById('btn-download-pdf');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = \`
      <svg class="animate-spin" style="animation: spin 1s linear infinite; margin-right: 6px;" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      กำลังสร้าง PDF...
    \`;

    try {
      let filename = 'document.pdf';
      const headerEl = document.querySelector('.header');
      const subheaderEl = document.querySelector('.subheader');
      if (headerEl) {
        let nameText = headerEl.innerText.trim();
        if (subheaderEl) {
          const match = subheaderEl.innerText.match(/(REQ-\\d+|GI-\\d+)/i) || subheaderEl.innerText.match(/[A-Z0-9-]{6,25}/i);
          if (match) {
            nameText += '_' + match[0].trim();
          }
        }
        filename = nameText + '.pdf';
      }

      const element = document.body;
      const opt = {
        margin: [12, 12, 12, 12],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
</script>
`;
      
      const downloadUrl = `/api/view-document?bucket=${encodeURIComponent(String(bucket))}&path=${encodeURIComponent(String(filePath))}&download=true`;

      const injectBar = `
<div class="print-header-bar" data-html2pdf-ignore="true">
  <div class="title">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #60a5fa;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
    เครื่องมือจัดการเอกสาร (THAMC e-Material)
  </div>
  <div class="actions">
    <button class="btn-print" onclick="window.print()">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
      พิมพ์เอกสาร / บันทึกบราวเซอร์
    </button>
    <button id="btn-download-pdf" class="btn-pdf" onclick="downloadAsPDF()">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
      ดาวน์โหลด PDF (อัตโนมัติ)
    </button>
    <a href="${downloadUrl}">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
      ดาวน์โหลด HTML
    </a>
  </div>
</div>
`;

      finalHtml = finalHtml.slice(0, bodyIndex) + injectStyle + injectBar + finalHtml.slice(bodyIndex);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(finalHtml);
  } catch (error: any) {
    console.error("view-document error:", error);
    res.status(500).send("Error reading document from storage: " + error.message);
  }
});

app.post("/api/rpc", async (req, res) => {
  const { method, args } = req.body;
  if (!method || !functionsMap[method]) {
    return res.status(400).json({ error: true, message: `Method '${method}' not found` });
  }

  try {
    const fnArgs = Array.isArray(args) ? args : [];
    const result = await functionsMap[method](...fnArgs);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error(`RPC Execution Error in method '${method}':`, error);
    res.status(500).json({ error: true, message: error.message || "Internal server error" });
  }
});

// ============================================================
// VITE DEV SERVER / PRODUCTION STATIC ASSETS
// ============================================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
