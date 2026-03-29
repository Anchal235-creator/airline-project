const mysql = require("mysql2");

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
    host: "127.0.0.1", 
    user: "root",
    password: "ashsakanc",
    database: "airline_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the pool connection
pool.getConnection((err, connection) => {
    if (err) {
        console.log("❌ Database pool connection failed!", err);
    } else {
        console.log("✅ Connected to MySQL Database Pool");
        connection.release();
    }
});


// Function to get booking details for confirmation page
const getBookingDetails = (bookingId, callback) => {
    pool.query("SELECT * FROM bookings WHERE booking_id = ?", [bookingId], (err, result) => {
        if (err) {
            console.log("❌ Error getting booking details:", err);
            callback(err, null);
        } else {
            callback(null, result[0]);
        }
    });
};

// Export the function and the pool itself
module.exports = {
    pool,
    getBookingDetails
};
module.exports = pool;
