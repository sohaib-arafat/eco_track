const axios = require('axios');
const con = require('../../project_connections/database_connection');
const {findMaxKey} = require("../common_methods");
const {addPoints} = require("../score_sys/scoring");
const publishToPub = require("../alert/messaging_client");
require('dotenv').config()
const uploadData = async (req, res) => {
    try {
        const {value, type, notes, collectionDate} = req.body;

        if (!value || !type || !notes || !collectionDate) {
            return res.status(400).send("Invalid Data");
        }

        const response = await axios.post( process.env.NLP_ENDPOINT, {
            "input_phrase": notes + " " + type,
            "matchers": {
                "clean_energy": "Clean Energy",
                "global_warming": "Global Warming",
                "deforestation": "Deforestation",
                "extinction": "Extinction",
                "air_pollution": "Air Pollution",
                "water_pollution": "Water Pollution",
                "noise_pollution": "Noise Pollution"
            }
        });

        if (!response.data.results) {
            return res.status(500).send("Error fetching match percentage");
        }

        const concern = findMaxKey(response.data.results);
        const user = req.user.email;

        const sql = "INSERT INTO EnvData (Value, Type, Notes, CollectionDate, Concern, Source) VALUES (?, ?, ?, ?, ?, ?)";
        await con.query(sql, [value, type, notes, collectionDate, concern, user]);
        addPoints(user, 5)
        const dataToPub = {"type": "data", "concern":concern, "owner": user, "title": type, "value":value}
        await publishToPub(dataToPub);
        res.send("Data uploaded");
    } catch (error) {
        console.error("Error uploading data:", error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {uploadData};
