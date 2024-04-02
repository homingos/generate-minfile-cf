import axios from "axios";
import fs from "fs";
import express from "express";
import puppeteer from "puppeteer";
import { Storage } from '@google-cloud/storage';


const app = express();

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}


export const waitForDownload = async (path, targetFileName, timeout) => {
  if (timeout) {
    timeout = time(timeout);
  } else {
    timeout = Infinity;
  }

  let filename;
  let filepath;
  let hrStart;
  let hrEnd;
  let timeElapsed = 0;

  while (!filename || filename.endsWith(".crdownload")) {
    while (!fs.existsSync(path));

    hrStart = process.hrtime();
    filepath = fs.readdirSync(path);

    // const checkfile = filepath.includes(targetFileName);

    filename = filepath.includes(targetFileName) ? targetFileName : null;

    if (!filename) {
      continue;
    }

    hrEnd = process.hrtime(hrStart)[1] / 1000000;

    timeElapsed += hrEnd;
    if (timeElapsed > timeout) {
      return false;
    }
  }

  return filename;
};

const downloadFileAndgetLocation = async (file_url) => {
  const file_name = file_url.split("/").pop();
  const file_location = "./temp/" + file_name;
  console.log("downloadFileAndgetLocation", file_url, file_location);

  if (!fs.existsSync("./temp")) {
    fs.mkdirSync("./temp");
  }

  const response = await axios({
    url: file_url,
    method: "GET",
    responseType: "stream",
    maxBodyLength: Infinity,
  });

  const writer = fs.createWriteStream(file_location);

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", () => resolve(file_location));
    writer.on("error", reject);
  });
};

const cleanupTempFile = async (directoryPath) => {
  try {
    await fs.promises.rmdir(directoryPath, { recursive: true });
    console.log(`Directory ${directoryPath} deleted successfully.`);

  } catch (err) {
    console.error('Error while removing temporary file:', err);
  }
}

const deleteFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
    console.log(`${filePath} File deleted successfully.`);
  } catch (err) {
    console.error('Error deleting file:', err);
  }
}

const uploadToGCS = async (file_location, bucket_name, upload_prefix, final_output_name) => {
  return new Promise(async (resolve, reject) => {
    const storage = new Storage();
    const bucket = storage.bucket(bucket_name);

    try {
      const destinationPath = `${upload_prefix}${final_output_name}`
      await bucket.upload(file_location, {
        destination: destinationPath,
      });

      const fileUploadedUrl = `https://storage.googleapis.com/${bucket_name}/${destinationPath}`;
      resolve(fileUploadedUrl);
    } catch (err) {
      console.error('Error uploading image to GCS:', err);
      reject(err);
    }
  })
}



app.get('/generate-mindfile', async (req, res) => {
  // Launch the browser and open a new blank page
  let imgUrl = req.query.img;
  let objectId = req.query.id;
  let env = req.query.env;
  console.log(imgUrl, objectId, env);
  // Validate query parameters
  if (!imgUrl && !objectId && !env) {
    return res.status(400).send("Missing img  query parameters");
  }

  const browser = await puppeteer.launch();
  // const browser = await puppeteer.launch({
  //   headless: true,
  //   executablePath: '/usr/bin/chromium-browser',
  //   args: [
  //     '--no-sandbox',
  //     // '--disable-gpu',
  //   ]
  // });

  const page = await browser.newPage();

  try {
    console.log("0% - Started!");

    const location = await downloadFileAndgetLocation(imgUrl);

    // Navigate the page to a URL
    await page.goto("https://hiukim.github.io/mind-ar-js-doc/tools/compile");

    // Set screen size
    // await page.setViewport({ width: 1080, height: 1024 });
    console.log("10%");

    // Upload file
    const fileInput = await page.waitForSelector('input[type="file"]');

    await fileInput.uploadFile(location);

    console.log("30%");

    // Wait and click on first result
    const startSelector = "button ::-p-text(Start)";
    await page.waitForSelector(startSelector);
    await page.click(startSelector);

    console.log("50%");

    // while(true) {
    //   const data = await page.evaluate(
    //     () => document.querySelector(".padding-vert--md").outerHTML
    //   );
    //   try {
    //     const startDownloadSelector = "div ::-p-text(Progress: )";
    //     await page.waitForSelector(startDownloadSelector);
    //   } catch {
    //     break;
    //   }
    //   console.log(data);
    // }

    const client = await page.createCDPSession();
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: "./temp",
    });

    console.log("80%");

    const startDownloadSelector = "button ::-p-text(Download compiled)";
    await page.waitForSelector(startDownloadSelector);
    await page.click(startDownloadSelector);

    const filename = await waitForDownload("./temp", `targets.mind`);
    console.log(filename);
    // delay(3000);
    console.log(`100% - ${filename} Download Complete.`);

    if (objectId) {
      const bucketName = "zingcam";
      const uploadPrefix = `flam/${env}/mindfiles/`;
      const mindFileUrl = await uploadToGCS(`./temp/${filename}`, bucketName, uploadPrefix, `${objectId}.mind`);
      console.log(mindFileUrl);
      let postbackPayload = {
        "instant_id": objectId,
        "mind_url": mindFileUrl
      }
      let update_postback_url = env == "prod" ?
        "https://zingcam.prod.flamapp.com/zingcam/instant/update/post-back" : env == "stage" ?
          "https://zingcam.stage.flamapp.com/zingcam/instant/update/post-back"
          : "https://zingcam.dev.flamapp.com/zingcam/instant/update/post-back"

      try {
        await axios.put(update_postback_url, postbackPayload)
      } catch (error) {
        console.log(error)
      }

      res.status(200).send("ok");
    }

    await cleanupTempFile('./temp')

    await browser.close();
    console.log("Session Closed.");
  } catch (error) {
    console.error("Error uploading and downloading file:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on Port: ${PORT}`))