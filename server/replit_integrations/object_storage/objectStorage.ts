import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size);
      const range = res.req.headers.range;
      
      let contentType = (metadata.contentType as string) || "audio/webm";
      
      // Simplify Content-Type to avoid codec issues on different platforms
      if (file.name.endsWith(".mp4") || file.name.endsWith(".m4a")) {
        contentType = "audio/mp4";
      } else if (file.name.endsWith(".webm")) {
        contentType = "audio/webm";
      } else if (contentType.includes("audio/mp4")) {
        contentType = "audio/mp4";
      } else if (contentType.includes("audio/webm")) {
        contentType = "audio/webm";
      } else if (contentType.includes("audio/mpeg") || file.name.endsWith(".mp3")) {
        contentType = "audio/mpeg";
      } else if (contentType.includes("audio/ogg") || file.name.endsWith(".ogg")) {
        contentType = "audio/ogg";
      } else if (contentType.includes("audio/wav") || file.name.endsWith(".wav")) {
        contentType = "audio/wav";
      }

      // Add debug logging
      console.log(`Serving file: ${file.name}, Content-Type: ${contentType}, Size: ${size}, Range: ${range || 'none'}`);
      
      // Essential headers for audio streaming
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", contentType);

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
        
        // Validate range
        if (isNaN(start) || start >= size || end >= size) {
          res.writeHead(416, {
            "Content-Range": `bytes */${size}`,
            "Content-Type": contentType,
            "Accept-Ranges": "bytes"
          });
          return res.end();
        }

        const chunksize = (end - start) + 1;
        
        const headers: Record<string, string | number> = {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
          "X-Content-Type-Options": "nosniff",
        };
        
        res.writeHead(206, headers);

        const stream = file.createReadStream({ start, end });
        stream.on('error', (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);
      } else {
        const headers: Record<string, string | number> = {
          "Content-Length": size,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Access-Control-Allow-Origin": "*",
          "X-Content-Type-Options": "nosniff",
        };
        
        res.writeHead(200, headers);

        const stream = file.createReadStream();
        stream.on('error', (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) res.status(500).end();
        });
        stream.pipe(res);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const signedUrl = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    
    // Auto-set public access for simplicity in this app
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    // We can't set ACL before file exists, but we can return a path that our server serves
    
    return signedUrl;
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/") && !rawPath.startsWith("http://") && !rawPath.startsWith("https://")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    try {
      const url = new URL(rawPath);
      const rawObjectPath = url.pathname;
    
      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) {
        objectEntityDir = `${objectEntityDir}/`;
      }
    
      if (!rawObjectPath.startsWith(objectEntityDir)) {
        return rawObjectPath;
      }
    
      // Extract the entity ID from the path
      const entityId = rawObjectPath.slice(objectEntityDir.length);
      return `/objects/${entityId}`;
    } catch (e) {
      return rawPath;
    }
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

