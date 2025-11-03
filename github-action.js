const core = require("@actions/core");
const exec = require('@actions/exec');
const glob = require('@actions/glob');
const fs = require("fs");
const path = require("path");
const FormData = require('form-data');
const axios = require('axios');

function isID(str) {
  return !(isNaN(str) || str.includes("."));
}

async function executeTests() {
  if (fs.existsSync('composer.json')) {
    await exec.exec('composer run prestaflow:json:file');
  }
}

async function run() {
  try {
    await executeTests();
    const token = core.getInput("token", { required: false });
    const projectId = core.getInput("project_id", { required: false });
    if (!isID(projectId)) {
      core.setFailed("Invalid project ID! (Must be an integer)");
    }

    const form = new FormData();

    const patterns = ['**/prestaflow/results.json', '**/prestaflow/screens/errors/*.png'];
    const globber = await glob.create(patterns.join('\n'))
    for await (const file of globber.globGenerator()) {
      core.debug(`Found file: ${file}`);
      let stats = fs.statSync(file);
      if (stats.isFile()) {
        const fileName = path.basename(file);

        if (file.includes('screens')) {
          let fileNameT = 'screens/' + fileName;
          form.append('file[]', fs.createReadStream(file), fileNameT);
        } else {
          form.append('file[]', fs.createReadStream(file), fileName);
        }
      }
    }

    axios.defaults.baseURL = 'https://api.prestaflow.io';

    const endpoint = `/ci/github-action/`;

    await axios.post(endpoint, form, {
      headers: {
        ...form.getHeaders(),
        //Authorization: 'Bearer ...', // optional
        "X-Api-Token": token,
      },
    }).then(function (response) {
      core.setOutput("id", response.data.id);
    }).catch(function (error) {
      if (error.response) {
        core.setFailed(
          `${error.response.statusText}`
        );
      } else {
        core.setFailed(
          `${error.message}`
        );
      }
    });
  } catch (error) {
    core.setFailed(error.message);
    throw error;
  }
}

run();
