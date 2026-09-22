/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * This file is auto-generated. Do not modify it manually.
 * Changes to this file may be overwritten.
 */

export const dataSourcesInfo = {
  "cr6b0_consultants": {
    "tableId": "",
    "version": "",
    "primaryKey": "cr6b0_consultantid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "cr6b0_projects": {
    "tableId": "",
    "version": "",
    "primaryKey": "cr6b0_projectid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_beginmediaupload": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_BeginMediaUpload": {
        "path": "/api/data/v9.2/nx_BeginMediaUpload",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Kind",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "FileName",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Size",
            "in": "body",
            "required": true,
            "type": "number"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_beginresumableupload": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_BeginResumableUpload": {
        "path": "/api/data/v9.2/nx_BeginResumableUpload",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "FileName",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Size",
            "in": "body",
            "required": true,
            "type": "number"
          },
          {
            "name": "Sha256",
            "in": "body",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_capabilities": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_capabilityid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_demoassets": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_demoassetid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_demorequests": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_demorequestid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_finishmediaupload": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_FinishMediaUpload": {
        "path": "/api/data/v9.2/nx_FinishMediaUpload",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "SessionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getdraftgraph": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetDraftGraph": {
        "path": "/api/data/v9.2/nx_GetDraftGraph",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getdraftmedia": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetDraftMedia": {
        "path": "/api/data/v9.2/nx_GetDraftMedia",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getmycoredrafts": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetMyCoreDrafts": {
        "path": "/api/data/v9.2/nx_GetMyCoreDrafts",
        "method": "POST",
        "parameters": [
          {
            "name": "PageNumber",
            "in": "body",
            "required": false,
            "type": "number"
          },
          {
            "name": "PagingCookie",
            "in": "body",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getpublisheddetail": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetPublishedDetail": {
        "path": "/api/data/v9.2/nx_GetPublishedDetail",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "Present",
            "in": "body",
            "required": true,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getsubmission": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetSubmission": {
        "path": "/api/data/v9.2/nx_GetSubmission",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getsubmissions": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetSubmissions": {
        "path": "/api/data/v9.2/nx_GetSubmissions",
        "method": "POST",
        "parameters": [
          {
            "name": "ReviewQueue",
            "in": "body",
            "required": true,
            "type": "boolean"
          },
          {
            "name": "PageNumber",
            "in": "body",
            "required": false,
            "type": "number"
          },
          {
            "name": "PagingCookie",
            "in": "body",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_getuploadcheckpoint": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_GetUploadCheckpoint": {
        "path": "/api/data/v9.2/nx_GetUploadCheckpoint",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "SessionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "FileName",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Size",
            "in": "body",
            "required": true,
            "type": "number"
          },
          {
            "name": "Sha256",
            "in": "body",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_industries": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_industryid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_readvideorange": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_ReadVideoRange": {
        "path": "/api/data/v9.2/nx_ReadVideoRange",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "AssetId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "Mode",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Offset",
            "in": "body",
            "required": true,
            "type": "number"
          },
          {
            "name": "Count",
            "in": "body",
            "required": true,
            "type": "number"
          },
          {
            "name": "Version",
            "in": "body",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_removedraftmedia": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_RemoveDraftMedia": {
        "path": "/api/data/v9.2/nx_RemoveDraftMedia",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "SessionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_savecoredraft": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_SaveCoreDraft": {
        "path": "/api/data/v9.2/nx_SaveCoreDraft",
        "method": "POST",
        "parameters": [
          {
            "name": "DraftJson",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "SolutionId",
            "in": "body",
            "required": false,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_savedraftgraph": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_SaveDraftGraph": {
        "path": "/api/data/v9.2/nx_SaveDraftGraph",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "GraphJson",
            "in": "body",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_solutioncontributors": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_solutioncontributorid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_solutionimages": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_solutionimageid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_solutions": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_solutionid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_specializationareas": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_specializationareaid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_technologies": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_technologyid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "nx_transitionsubmission": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_TransitionSubmission": {
        "path": "/api/data/v9.2/nx_TransitionSubmission",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Action",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "Comments",
            "in": "body",
            "required": false,
            "type": "string"
          },
          {
            "name": "Cleared",
            "in": "body",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "nx_uploadmediablock": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "nx_UploadMediaBlock": {
        "path": "/api/data/v9.2/nx_UploadMediaBlock",
        "method": "POST",
        "parameters": [
          {
            "name": "SolutionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "ExpectedRowVersion",
            "in": "body",
            "required": true,
            "type": "string"
          },
          {
            "name": "SessionId",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "BlockIndex",
            "in": "body",
            "required": true,
            "type": "number"
          },
          {
            "name": "Content",
            "in": "body",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "office365users": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Connector",
    "apis": {
      "UpdateMyProfile": {
        "path": "/{connectionId}/codeless/v1.0/me",
        "method": "PATCH",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": false,
            "type": "object"
          }
        ],
        "responseInfo": {
          "default": {
            "type": "void"
          }
        }
      },
      "MyProfile_V2": {
        "path": "/{connectionId}/codeless/v1.0/me",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "UpdateMyPhoto": {
        "path": "/{connectionId}/codeless/v1.0/me/photo/$value",
        "method": "PUT",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "body",
            "in": "body",
            "required": true,
            "type": "string",
            "format": "binary"
          },
          {
            "name": "Content-Type",
            "in": "header",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "default": {
            "type": "void"
          }
        }
      },
      "MyTrendingDocuments": {
        "path": "/{connectionId}/codeless/beta/me/insights/trending",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$filter",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "extractSensitivityLabel",
            "in": "query",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "fetchSensitivityLabelMetadata",
            "in": "query",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "RelevantPeople": {
        "path": "/{connectionId}/users/{userId}/relevantpeople",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "MyProfile": {
        "path": "/{connectionId}/users/me",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "202": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UserProfile": {
        "path": "/{connectionId}/users/{userId}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "202": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UserPhotoMetadata": {
        "path": "/{connectionId}/users/photo",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "userId",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UserPhoto": {
        "path": "/{connectionId}/users/photo/value",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "userId",
            "in": "query",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "string",
            "format": "binary"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "Manager": {
        "path": "/{connectionId}/users/{userId}/manager",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "202": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "DirectReports": {
        "path": "/{connectionId}/users/{userId}/directReports",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "userId",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          },
          "202": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "SearchUser": {
        "path": "/{connectionId}/users",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "searchTerm",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "top",
            "in": "query",
            "required": false,
            "type": "integer",
            "format": "int32"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          },
          "202": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "SearchUserV2": {
        "path": "/{connectionId}/v2/users",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "searchTerm",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "top",
            "in": "query",
            "required": false,
            "type": "integer",
            "format": "int32"
          },
          {
            "name": "isSearchTermRequired",
            "in": "query",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "skipToken",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "202": {
            "type": "void"
          },
          "400": {
            "type": "void"
          },
          "401": {
            "type": "void"
          },
          "403": {
            "type": "void"
          },
          "500": {
            "type": "void"
          },
          "default": {
            "type": "void"
          }
        }
      },
      "UserProfile_V2": {
        "path": "/{connectionId}/codeless/v1.0/users/{id}",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "Manager_V2": {
        "path": "/{connectionId}/codeless/v1.0/users/{id}/manager",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "DirectReports_V2": {
        "path": "/{connectionId}/codeless/v1.0/users/{id}/directReports",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$select",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "$top",
            "in": "query",
            "required": false,
            "type": "integer",
            "format": "int32"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "UserPhoto_V2": {
        "path": "/{connectionId}/codeless/v1.0/users/{id}/photo/$value",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "string",
            "format": "binary"
          }
        }
      },
      "TrendingDocuments": {
        "path": "/{connectionId}/codeless/beta/users/{id}/insights/trending",
        "method": "GET",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "$filter",
            "in": "query",
            "required": false,
            "type": "string"
          },
          {
            "name": "extractSensitivityLabel",
            "in": "query",
            "required": false,
            "type": "boolean"
          },
          {
            "name": "fetchSensitivityLabelMetadata",
            "in": "query",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "HttpRequest": {
        "path": "/{connectionId}/codeless/httprequest",
        "method": "POST",
        "parameters": [
          {
            "name": "connectionId",
            "in": "path",
            "required": true,
            "type": "string"
          },
          {
            "name": "Uri",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "Method",
            "in": "header",
            "required": true,
            "type": "string"
          },
          {
            "name": "Body",
            "in": "body",
            "required": false,
            "type": "string",
            "format": "binary"
          },
          {
            "name": "ContentType",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "CustomHeader1",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "CustomHeader2",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "CustomHeader3",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "CustomHeader4",
            "in": "header",
            "required": false,
            "type": "string"
          },
          {
            "name": "CustomHeader5",
            "in": "header",
            "required": false,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          },
          "default": {
            "type": "void"
          }
        }
      }
    }
  }
};
