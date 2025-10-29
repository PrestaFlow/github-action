const core = require("@actions/core");
const exec = require('@actions/exec');
const glob = require('@actions/glob');

const fs = require("fs");
const req = require("request");
const util = require('util');

function isID(str) {
  return !(isNaN(str) || str.includes("."));
}

async function executeTests() {
  console.log('Executing composer run prestaflow:json:file command:');
  const { stdout, stderr } = await exec.exec('composer run prestaflow:json:file');
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
}

async function run() {
  try {
    await executeTests();
    const token = core.getInput("token", { required: false });
    const projectId = core.getInput("project_id", { required: false });
    if (!isID(projectId)) {
      core.setFailed("Invalid project ID! (Must be an integer)");
    }
    const filePath = core.getInput("file_path", { required: false });

    const patterns = ['**/prestaflow/results.json', '**/prestaflow/screens/**'];
    const globber = await glob.create(patterns.join('\n'))
    for await (const file of globber.globGenerator()) {
      console.log(file)
    }
    const globber2 = await glob.create('**')
    for await (const file of globber2.globGenerator()) {
      console.log(file)
    }
    //console.log(fs.globSync('*'))
    //if (!fs.existsSync(filePath)) {
    //  core.setFailed("Specified file at " + filePath + " does not exist!");
    //}

    const options = {
      method: "POST",
      url:
        "https://api.prestaflow.io/ci/github-action" +
        // projectId +
        //"/upload-file",
        "/",
      //port: 443,
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Api-Token": token,
      },
      formData: {
        file: fs.createReadStream(filePath),
      },
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
