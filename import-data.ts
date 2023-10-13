import { getTursoClient } from "./src/turso";
import seedrandom from "seedrandom";
const DEFAULT_DATA_FILE = "file:data";
const AUTHOR_NAMES = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Hannah",
  "Isaac",
  "Jack",
  "Kara",
  "Liam",
  "Mona",
  "Nate",
  "Olivia",
  "Paul",
  "Quincy",
  "Rita",
  "Sam",
  "Tara",
  "Ulysses",
  "Vera",
  "Will",
  "Xena",
  "Yara",
  "Zane",
];
const ARTICLE_TITLES = [
  "How to Code",
  "Databases 101",
  "Web Development",
  "Machine Learning",
  "Game Development",
  "The Future of Augmented Reality",
  "Understanding Cryptocurrencies",
  "Design Patterns in Software",
  "The World of Quantum Computing",
  "Cloud Computing: An Introduction",
  "The Basics of Mobile App Development",
  "Virtual Reality: Beyond Gaming",
  "Cybersecurity Best Practices",
  "Deep Dive into Neural Networks",
  "IoT: The Next Tech Revolution",
  "The Rise of Progressive Web Apps",
  "Exploring Data Science Techniques",
  "Serverless Architectures",
  "Big Data: Challenges and Opportunities",
  "The Art of UX/UI Design",
  "Functional Programming Paradigm",
  "Blockchain: Beyond Bitcoin",
  "Adventures in 3D Printing",
  "The Ethics of Artificial Intelligence",
  "Modern Front-End Frameworks",
  "Unveiling 5G Technology",
  "The Power of Microservices",
  "Open Source Software Contributions",
  "Digital Marketing in Today's World",
  "Agile and Scrum in Project Management",
];
const SEED = "HasuraRocks";

async function setupDatabase() {
  let client = getTursoClient({ url: DEFAULT_DATA_FILE });
  try {
    await client.execute(`DROP TABLE IF EXISTS article;`);
    await client.execute(`DROP TABLE IF EXISTS author;`);

    // Create authors table without the BLOB field
    await client.execute(`
            CREATE TABLE IF NOT EXISTS author (
                author_id INTEGER PRIMARY KEY, 
                name TEXT NOT NULL, 
                email TEXT UNIQUE, 
                rating REAL
            )
        `);

    // Create articles table (remains unchanged)
    await client.execute(`
            CREATE TABLE IF NOT EXISTS article (
                article_id INTEGER PRIMARY KEY, 
                title TEXT, 
                content TEXT, 
                price REAL, 
                author_id INTEGER,
                FOREIGN KEY(author_id) REFERENCES author(author_id)
            )
        `);
  } catch (e) {
    console.error(e);
  }
}

async function fillDatabase(authorCount: number, articleCount: number) {
  let client = getTursoClient({ url: DEFAULT_DATA_FILE });

  const rng = seedrandom(SEED);

  const randomChoice = (arr: any) => arr[Math.floor(rng() * arr.length)];
  const randomRating = () => (rng() * 5).toFixed(2);
  const randomPrice = () => (rng() * 20).toFixed(2);
  const maybeNull = <T>(value: T, nullProbability: number = 0.2): T | null => {
    return rng() < nullProbability ? null : value; // Use rng() instead of Math.random()
  };

  try {
    // Insert random authors without the BLOB
    for (let i = 0; i < authorCount; i++) {
      const name = `${randomChoice(AUTHOR_NAMES)}${i.toString()}`;
      const email = `${name.toLowerCase()}@email`;
      const rating = randomRating();

      await client.execute({
        sql: "INSERT INTO author (name, email, rating) VALUES (?, ?, ?)",
        args: [name, email, rating],
      });
    }

    // Insert random articles (remains unchanged)
    for (let i = 0; i < articleCount; i++) {
      const title = `${i.toString()} ${randomChoice(ARTICLE_TITLES)}`;
      const content = `Content for ${title}`;
      const price = maybeNull(randomPrice());
      const author_id = (i % authorCount) + 1;
      await client.execute({
        sql: "INSERT INTO article (title, content, price, author_id) VALUES (?, ?, ?, ?)",
        args: [title, content, price, author_id],
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function printDatabaseSchema() {
  let client = getTursoClient({ url: DEFAULT_DATA_FILE });

  try {
    // Get list of all tables from the sqlite_master table
    const tablesResult = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    // Extract table names from the result
    const tableNames = tablesResult.rows.map((row) => row.name);
    for (let table of tableNames) {
      const result = await client.execute(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`
      );

      if (result && result.rows && result.rows[0] && result.rows[0].sql) {
        console.log(`Schema for table ${table}:`);
        console.log(result.rows[0].sql);
        console.log("---------------------------------");
      }
    }
  } catch (e) {
    console.error("Error fetching the schema:", e);
  }
}

async function printDatabaseHead(rows: number) {
  let client = getTursoClient({ url: DEFAULT_DATA_FILE });

  try {
    // Get list of all tables from the sqlite_master table
    const tablesResult = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );

    // Extract table names from the result
    const tableNames = tablesResult.rows.map((row) => row.name);

    for (let table of tableNames) {
      const result = await client.execute(
        `SELECT * FROM ${table} LIMIT ${rows}`
      );

      if (result && result.rows && result.rows.length > 0) {
        console.log(`First ${rows} rows of table ${table}:`);
        console.table(result.rows);
        console.log("---------------------------------");
      } else {
        console.log(`Table ${table} has no rows.`);
        console.log("---------------------------------");
      }
    }
  } catch (e) {
    console.error("Error fetching the data:", e);
  }
}

async function main() {
  await setupDatabase();
  await fillDatabase(10, 100);
  await printDatabaseSchema();
  await printDatabaseHead(11);
}

main().catch((err) => {
  console.error(`An error has ocurred ${err.message}`);
  process.exit(1);
});
