// require("dotenv").config({ path: "./.env" });
import dotenv from "dotenv";
import connect from "./db/db.js";

dotenv.config({ path: "./.env" });
connect();
