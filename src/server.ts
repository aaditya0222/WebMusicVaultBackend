import app from "./app";
import connectDb from "./config/config";
import { env } from "./config/env";
import "./config/passport";
const startServer = async (): Promise<void> => {
  try {
    await connectDb();
    app.listen(env.PORT);
    console.log("Successfully Started Server");
    console.log("Test backend ci");
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        "Error while starting the server: ",
        error.message,
        "\n",
        error,
      );
    } else {
      console.error("Error: ", error);
    }
    process.exit(1);
  }
};

startServer();
