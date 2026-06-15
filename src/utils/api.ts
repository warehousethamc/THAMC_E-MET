export function resolveApiUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  
  let apiBase = "";
  // Detect if hosted on GitHub Pages or independent static sites
  if (
    window.location.hostname.endsWith(".github.io") || 
    (window.location.hostname !== "localhost" && 
     window.location.hostname !== "127.0.0.1" && 
     !window.location.hostname.includes("run.app"))
  ) {
    apiBase = localStorage.getItem("backend_api_url") || "https://ais-pre-oz7nezk4tpzgmervnkkonx-966862217040.asia-southeast1.run.app";
  }
  
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase}${cleanPath}`;
}

export async function runScript(method: string, ...args: any[]): Promise<any> {
  try {
    const response = await fetch(resolveApiUrl("/api/rpc"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ method, args }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(data.message || "Failed to execute server function.");
    }
    return data.result;
  } catch (error: any) {
    console.error(`API Call error in ${method}:`, error);
    throw error;
  }
}

export function formatNumber(num: number | string | null | undefined, decimals = 2): string {
  if (num === null || num === undefined) return (0).toFixed(decimals);
  const parsed = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(parsed)) return (0).toFixed(decimals);
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    if (typeof dateString === "string" && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-");
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "-";
  }
}

export function formatDateTimeForDisplay(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "-";
  }
}
