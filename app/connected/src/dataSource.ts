import { getContext } from "@microsoft/power-apps/app";
import { Office365UsersService } from "./generated/services/Office365UsersService";
import type { AppUser } from "../../src/lib/powerContext";
import type { ReadRows } from "./catalogue";
import { Nx_solutionsService } from "./generated/services/Nx_solutionsService";
import { Nx_specializationareasService } from "./generated/services/Nx_specializationareasService";
import { Nx_capabilitiesService } from "./generated/services/Nx_capabilitiesService";
import { Nx_technologiesService } from "./generated/services/Nx_technologiesService";
import { Nx_industriesService } from "./generated/services/Nx_industriesService";
import { Nx_SaveCoreDraftService } from "./generated/services/Nx_SaveCoreDraftService";
import { Nx_GetMyCoreDraftsService } from "./generated/services/Nx_GetMyCoreDraftsService";
import type { DraftApi } from "./drafts";
import { Cr6b0_consultantsService } from "./generated/services/Cr6b0_consultantsService";
import { Cr6b0_projectsService } from "./generated/services/Cr6b0_projectsService";
import { Nx_GetDraftGraphService } from "./generated/services/Nx_GetDraftGraphService";
import { Nx_SaveDraftGraphService } from "./generated/services/Nx_SaveDraftGraphService";
import type { GraphApi } from "./draftGraph";
import type { MediaApi, MediaItem } from "./media";
import { Nx_GetDraftMediaService } from "./generated/services/Nx_GetDraftMediaService";
import { Nx_BeginMediaUploadService } from "./generated/services/Nx_BeginMediaUploadService";
import { Nx_UploadMediaBlockService } from "./generated/services/Nx_UploadMediaBlockService";
import { Nx_FinishMediaUploadService } from "./generated/services/Nx_FinishMediaUploadService";
import { Nx_RemoveDraftMediaService } from "./generated/services/Nx_RemoveDraftMediaService";
import { getClient } from "@microsoft/power-apps/data";
import { dataSourcesInfo } from "../.power/schemas/appschemas/dataSourcesInfo";
import { Nx_GetSubmissionsService } from "./generated/services/Nx_GetSubmissionsService";
import { Nx_GetSubmissionService } from "./generated/services/Nx_GetSubmissionService";
import { Nx_TransitionSubmissionService } from "./generated/services/Nx_TransitionSubmissionService";
import { Nx_GetPublishedDetailService } from "./generated/services/Nx_GetPublishedDetailService";
import type { WorkflowApi } from "./workflow";
import { Nx_BeginResumableUploadService } from "./generated/services/Nx_BeginResumableUploadService";
import { Nx_GetUploadCheckpointService } from "./generated/services/Nx_GetUploadCheckpointService";
import { Nx_ReadVideoRangeService } from "./generated/services/Nx_ReadVideoRangeService";
import type { TransferApi } from "./mediaTransfer";

export const transferApi: TransferApi = {
  begin: (...args) => Nx_BeginResumableUploadService.nx_BeginResumableUpload(...args),
  checkpoint: (...args) => Nx_GetUploadCheckpointService.nx_GetUploadCheckpoint(...args),
  range: (...args) => Nx_ReadVideoRangeService.nx_ReadVideoRange(...args),
};

export const workflowApi: WorkflowApi = {
  list: (review, page, cookie) => Nx_GetSubmissionsService.nx_GetSubmissions(review, page, cookie),
  read: id => Nx_GetSubmissionService.nx_GetSubmission(id),
  transition: (id, version, action, comments, cleared) => Nx_TransitionSubmissionService.nx_TransitionSubmission(id, version, action, comments, cleared),
  published: (id, present) => Nx_GetPublishedDetailService.nx_GetPublishedDetail(id, present),
};

export const mediaApi: MediaApi = {
  read: id => Nx_GetDraftMediaService.nx_GetDraftMedia(id),
  begin: (id, version, kind, name, size) => Nx_BeginMediaUploadService.nx_BeginMediaUpload(id, version, kind, name, size),
  block: (id, version, session, index, content) => Nx_UploadMediaBlockService.nx_UploadMediaBlock(id, version, session, index, content),
  finish: (id, version, session) => Nx_FinishMediaUploadService.nx_FinishMediaUpload(id, version, session),
  remove: (id, version, session) => Nx_RemoveDraftMediaService.nx_RemoveDraftMedia(id, version, session),
  metadata: (id, version, json) => Nx_TransitionSubmissionService.nx_TransitionSubmission(id, version, "media", json, false),
};

export async function downloadMedia(item: MediaItem): Promise<Blob> {
  if (item.linkedAsset) throw new Error("Linked assets do not contain a downloadable file.");
  if (!item.complete) throw new Error("Media is not finalized.");
  const client = getClient(dataSourcesInfo);
  const result = item.kind !== "attachment"
    ? await client.downloadImageFromRecord("nx_solutionimages", item.id, "nx_imagefile", true)
    : await client.downloadFileFromRecord("nx_demoassets", item.id, "nx_filemedia");
  if (!result.success || !result.data?.length) throw new Error("Media download failed.");
  return new Blob([new Uint8Array(result.data)], { type: item.mime });
}

export const graphApi: GraphApi = {
  read: id => Nx_GetDraftGraphService.nx_GetDraftGraph(id),
  save: (id, version, json) => Nx_SaveDraftGraphService.nx_SaveDraftGraph(id, version, json),
};

export const draftApi: DraftApi = {
  list: (page, cookie) => Nx_GetMyCoreDraftsService.nx_GetMyCoreDrafts(page, cookie),
  save: (json, id, version) => Nx_SaveCoreDraftService.nx_SaveCoreDraft(json, id, version),
};

export async function getSignedInUser(): Promise<AppUser> {
  const context = await getContext();
  if (!context.user?.fullName || !context.user.userPrincipalName) throw new Error("Power Apps sign-in is required.");
  return { fullName: context.user.fullName, userPrincipalName: context.user.userPrincipalName, live: true };
}

export async function getUserPhoto(userPrincipalName: string): Promise<string | undefined> {
  if (!userPrincipalName) return;
  try {
    const result = await Office365UsersService.UserPhoto_V2(userPrincipalName);
    const photo = result.data;
    if (!result.success || typeof photo !== "string" || !photo.length || photo.length > 6 * 1024 * 1024) return;
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(photo)) return;
    const mime = photo.startsWith("/9j/") ? "image/jpeg" : photo.startsWith("iVBORw0KGgo") ? "image/png" : undefined;
    return mime ? `data:${mime};base64,${photo}` : undefined;
  } catch {
    return;
  }
}

export const readRows: ReadRows = (table, options) => {
  switch (table) {
    case "solutions": return Nx_solutionsService.getAll(options);
    case "areas": return Nx_specializationareasService.getAll(options);
    case "capabilities": return Nx_capabilitiesService.getAll(options);
    case "technologies": return Nx_technologiesService.getAll(options);
    case "industries": return Nx_industriesService.getAll(options);
    case "people": return Cr6b0_consultantsService.getAll(options);
    case "projects": return Cr6b0_projectsService.getAll(options);
  }
};