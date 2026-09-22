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
  "nx_industries": {
    "tableId": "",
    "version": "",
    "primaryKey": "nx_industryid",
    "dataSourceType": "Dataverse",
    "apis": {}
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
  }
};
