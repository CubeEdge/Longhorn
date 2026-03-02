const bcrypt = require("bcryptjs");
console.log("Match admin123?", bcrypt.compareSync("admin123", "$2b$10$9XXIKrySoLHLV5HMiL0HZOZpKRFhL4QaJNLQzRCpQssRe0yPQAclq"));
