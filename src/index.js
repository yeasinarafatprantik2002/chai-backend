import dotenv from "dotenv";
import connect from "./db/db.js";
import { app } from "./app.js";

dotenv.config({ path: "./.env" });
connect()
    .then(() => {
        app.on("error", (error) => {
            console.error("Express error: ", error);
            process.exit(1);
        });
        app.listen(process.env.PORT || 8000, () => {
            console.log(
                `Server is running on port ${process.env.PORT || 8000}`
            );
        });
    })
    .catch((error) => {
        console.error("MongoDB connection FAILED!: ", error);
        process.exit(1);
    });
