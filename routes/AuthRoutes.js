const { signup, login, getSponsorDetails, recoverPassword, resetPassword, deleteMember } = require("../controllers/Auth/AuthController");

const router = require("express").Router();

router.post("/signup", signup);
router.delete("/delete-member/:id", deleteMember);
router.get("/get-sponsor/:ref", getSponsorDetails);
router.post("/recover-password",recoverPassword)
router.post("/reset-password",resetPassword)
router.post("/login", login);

module.exports = router;

