require('express');
const bcrypt = require('bcrypt')
const con = require('../../project_connections/database_connection')
const {generateToken} = require("../auth");
const {loggingPoint} = require("../scoring_system/scoring");
const queryAsync = async (sql, params) => {
    return new Promise((resolve, reject) => {
        con.query(sql, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};
const registerNewAccount = async (req, res) => {
    try {
        const {Fname, Lname, Email, Password, Profession} = req.body;

         const existingUserQuery = "SELECT Email FROM Profile WHERE Email = ?";
        const result = await queryAsync(existingUserQuery, [Email.toLowerCase()]);

        if (result.length) {
            return res.status(400).send("Email already exists");
        }

         const hashPass = await bcrypt.hash(Password, 10);

         const insertProfileQuery = "INSERT INTO Profile (FirstName, LastName, Email, Profession, Score) VALUES (?, ?, ?, ?, ?)";
        await queryAsync(insertProfileQuery, [Fname, Lname, Email.toLowerCase(), Profession, 1]);

         const insertUserPassQuery = "INSERT INTO UserPass (Email, Pass) VALUES (?, ?)";
        await queryAsync(insertUserPassQuery, [Email.toLowerCase(), hashPass]);

        return res.status(201).send("Registration successful. You can now proceed.");
    } catch (error) {
        console.error("Error during registration:", error);
        return res.status(500).send("Internal Server Error");
    }
};

const login = async (req, res) => {
    try {
        const {email, password} = req.body;
        const sql = "SELECT PASS FROM UserPass WHERE Email = ?";
        const result = await queryAsync(sql, [email.toLowerCase()]);

        if (!result || result.length === 0) {
            return res.status(404).send("User doesn't exist");
        }

        const isPasswordMatch = await bcrypt.compare(password, result[0].PASS);

        if (isPasswordMatch) {
            const userSql = "SELECT * FROM Profile WHERE Email = ?";
            const userResult = await queryAsync(userSql, [email.toLowerCase()]);

            if (userResult && userResult.length > 0) {
                const token = generateToken({
                    email: userResult[0].Email,
                    first_name: userResult[0].FirstName,
                    last_name: userResult[0].LastName,
                    profession: userResult[0].Profession,
                });

                loggingPoint(email);
                return res.send(token);
            }
        }

        return res.status(401).send("Incorrect email or password");
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).send("Internal Server Error");
    }
};


const updateProfile = async (req, res) => {
    try {
        const { newFirstName, newLastName, newProfession, newUserConcerns } = req.body;
        const currentEmail = req.user.email;

        let status = 200;
        let message = "Profile and concerns updated successfully";

         const existingUserQuery = "SELECT Email, FirstName, LastName, Profession FROM Profile WHERE Email = ?";
        const existingUser = await queryAsync(existingUserQuery, [currentEmail.toLowerCase()]);

        if (existingUser.length === 0) {
            status = 404;
            message = "User not found";
        } else {
             let updateFields = [];
            let updateValues = [];

            const fieldMap = {
                FirstName: newFirstName,
                LastName: newLastName,
                Profession: newProfession,
             };

            Object.entries(fieldMap).forEach(([field, value]) => {
                if (value !== undefined && value !== null) {
                    updateFields.push(`${field}=?`);
                    updateValues.push(value);
                }
            });

            if (updateFields.length > 0) {
                 const updateProfileQuery = `UPDATE Profile SET ${updateFields.join(', ')} WHERE Email=?`;
                await queryAsync(updateProfileQuery, [...updateValues, currentEmail.toLowerCase()]);
            }

             if (Array.isArray(newUserConcerns)) {
                const updateConcernsQuery = "UPDATE UserConcern SET Concern=? WHERE Email=?";

                for (let index = 0; index < newUserConcerns.length; index++) {
                    const concern = newUserConcerns[index];

                    if (concern !== null) {
                        await queryAsync(updateConcernsQuery, [concern, currentEmail.toLowerCase()]);
                    }
                }
            }
        }

        return res.send(message);
    } catch (error) {
        console.error("Error during profile update:", error);
        return res.status(500).send("Internal Server Error");
    }
};


const updatePassword = async (req, res) => {
    try {
        const {currentPassword, newPassword} = req.body;
        const email = req.user.email;

         const currentPasswordQuery = "SELECT Pass FROM UserPass WHERE Email=?";
        const result = await queryAsync(currentPasswordQuery, [email.toLowerCase()]);

        if (result.length === 0) {
            return res.status(404).send("User not found");
        }

         const isPasswordMatch = await bcrypt.compare(currentPassword, result[0].Pass);

        if (isPasswordMatch) {
             const hashPass = await bcrypt.hash(newPassword, 10);

             const updatePasswordQuery = "UPDATE UserPass SET Pass=? WHERE Email=?";
            await queryAsync(updatePasswordQuery, [hashPass, email.toLowerCase()]);

            return res.status(200).send("Password updated successfully");
        } else {
            return res.status(401).send("Current password is incorrect");
        }
    } catch (error) {
        console.error("Error updating password:", error);
        return res.status(500).send("Internal Server Error");
    }
};

const addConcern = async (req, res) => {
    try {
        const email = req.user.email; // Extract email from req.user
        const newConcern = req.params.newConcern; // Extract newConcern from req.params

         const checkExistingConcernQuery = "SELECT * FROM UserConcern WHERE User = ? AND Concern = ?";
        const checkResult = await queryAsync(checkExistingConcernQuery, [email.toLowerCase(), newConcern]);

        if (checkResult.length > 0) {
             return res.status(400).send("Concern already exists for the user");
        }

         const addConcernQuery = "INSERT INTO UserConcern (User, Concern) VALUES (?, ?)";
        await queryAsync(addConcernQuery, [email.toLowerCase(), newConcern]);

        return res.status(200).send("Concern added successfully");
    } catch (error) {
        console.error("Error adding concern:", error);
        return res.status(500).send("Internal Server Error");
    }
};
module.exports = {registerNewAccount, login, updateProfile, updatePassword, addConcern};

