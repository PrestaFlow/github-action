const core = require("@actions/core");
const fs = require("fs");
const req = require("request");

function isID(str) {
  return !(isNaN(str) || str.includes("."));
}

async function run() {
  try {
    const token = core.getInput("token", { required: true });
    const projectId = core.getInput("project_id", { required: true });
    if (!isID(projectId)) {
      core.setFailed("Invalid project ID! (Must be an integer)");
    }
    const filePath = core.getInput("file_path", { required: true });
    if (!fs.existsSync(filePath)) {
      core.setFailed("Specified file at " + filePath + " does not exist!");
    }

    const options = {
      method: "POST",
      url:
        "https://api.prestaflow.io/ci/github-action" +
        // projectId +
        //"/upload-file",
        "",
      //port: 443,
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Api-Token": token,
      },
      /*
      formData: {
        file: fs.createReadStream(filePath),
      },
      */
    };
    req.post(options, (err, response, body) => {
      if (!err) {
        core.debug("Response code: " + response.statusCode);
        if (response.statusCode == 200) {
          core.debug(`Response body:\n${response.body}`);
          core.setOutput("id", JSON.parse(body).id.toString());
        } else {
          core.setFailed(
            `${response.statusCode}: ${response.statusMessage}\nResponse body:\n${response.body}\nRequest body:${body}`
          );
        }
      } else {
        core.setFailed(
          `Request error:${err}\nResponse body:\n${response.body}\nRequest body:${body}`
        );
      }
    });
  } catch (error) {
    core.setFailed(error.message);
    throw error;
  }
}

run();
