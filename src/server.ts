import app from "./app";
import connectDb from "./config/config";
import { env } from "./config/env";
// import directUploader from "./scripts/directUploadFromSystem";
// import { checkDbData, checkDuplicateFiles } from "./scripts/mongodbfiletest";
// import directDownloader from "./scripts/directDownloadToSystem";
// import { updateDbEntries } from "./scripts/dbUpdates";
const startServer = async () => {
  try {
    await connectDb();
    app.listen(env.PORT);
    console.log("Successfully Started Server");
    // checkDbData();
    // checkDuplicateFiles();
    //-->give path of folder in which your songs are present
    // directUploader("D:/Personal Folders/Music/");
    // directDownloader("E:/Personal Folders/Music");
    // updateDbEntries();
  } catch (error) {
    if (error instanceof Error) {
      console.log("Error while starting the server: ", error.message, error);
    }
    process.exit(1);
  }
};

startServer();
