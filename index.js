import mongoose from "mongoose";

const NUM_PROPERTIES = 100;
const NUM_RANDOM_PROPERTIES = 10;

/** @type string[] */
const propertyKeys = [];
/** @type Record<string, object> */
const properties = {};

for (let i = 0; i < NUM_PROPERTIES; i++) {
    propertyKeys.push(`p${i}`);
    properties[propertyKeys[i]] = {
        type: String,
        required: true,
        default: "",
    };
}

async function main() {
    await mongoose.connect("mongodb://localhost:27017", {
        user: "root",
        pass: "root",
    });
    console.log("Connected to MongoDB.");

    const schema = new mongoose.Schema(properties);
    const Model = mongoose.model("Model", schema);

    console.log("Model initialized.");

    console.log("Creating random entries...");
    await Model.deleteMany({});
    await Model.create(
        Array.from({ length: 1000 }).map(() => createRandomEntry()),
    );
    console.log("Created random entries.");

    console.log("Starting benchmark...");
    const randomQuery = generateRandomQuery();

    const method1Label = "Method 1 - Passing filter directly to `find`";
    const method2Label =
        "Method 2 - Converting filter to a query of `_id: { $in: [] }`";
    console.time(method1Label);
    const resultsMethod1 = await Model.find(randomQuery);
    console.timeEnd(method1Label);

    console.time(method2Label);
    const queryMethod2 = await generateQueryUsingIds(randomQuery, Model);
    const resultsMethod2 = await Model.find(queryMethod2);
    console.timeEnd(method2Label);

    console.log("Checking results...");
    console.assert(resultsMethod1.length === resultsMethod2.length);
    const resultsMethod2Ids = resultsMethod2.map((r) => r._id.toString());
    for (const r of resultsMethod1) {
        console.assert(resultsMethod2Ids.includes(r._id.toString()));
    }
    console.log("Checked results.");

    console.log("Cleaning up database...");
    await Model.deleteMany({});
    console.log("Cleaned up database.");
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

function createRandomEntry() {
    const randomEntry = {};
    for (const key of propertyKeys) {
        randomEntry[key] = Math.random() < 0.5 ? "v1" : "v2";
    }
    return randomEntry;
}

function generateRandomQuery() {
    const randomQuery = {};
    for (let i = 0; i < NUM_RANDOM_PROPERTIES; i++) {
        const randomProperty = Math.floor(Math.random() * NUM_PROPERTIES);
        randomQuery[randomProperty] = Math.random() < 0.5 ? "v1" : "v2";
    }
    return randomQuery;
}

async function generateQueryUsingIds(givenQuery, model) {
    const query = [];
    for (const key in Object.keys(givenQuery)) {
        const results = await model
            .find({ key: givenQuery[key] }, { _id: 1 })
            .lean();
        const resultIds = results.map((r) => r._id);
        query.push({
            _id: { $in: resultIds },
        });
    }
    return {
        $and: query,
    };
}
