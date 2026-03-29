const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./db");

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(bodyParser.json());

/* ✅ POST API — Save Booking */
/* ✅ POST API — Save Booking + Auto Ticket */
app.post("/book", (req, res) => {
    const {
        passenger_name,
        email,
        phone,
        flight_no,
        source,
        destination,
        travel_date,
        passengers,
        travel_class
    } = req.body;

    const sql = `
        INSERT INTO bookings 
        (passenger_name, email, phone, flight_no, source, destination, travel_date, passengers, travel_class)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            passenger_name,
            email,
            phone,
            flight_no,
            source,
            destination,
            travel_date,
            passengers,
            travel_class
        ],
        (err, result) => {
            if (err) return res.status(500).json({ error: "Error inserting booking" });

            const bookingId = result.insertId;

            // Auto-generate ticket number + seat number
            const ticketNumber = "TCKT-" + Math.floor(Math.random() * 90000 + 10000);
            const seatNo = "S-" + Math.floor(Math.random() * 50 + 1);

            const ticketSQL = `
                INSERT INTO tickets (booking_id, ticket_number, seat_no)
                VALUES (?, ?, ?)
            `;

            db.query(ticketSQL, [bookingId, ticketNumber, seatNo], (err) => {
                if (err) return res.status(500).json({ error: "Ticket creation failed" });

                res.json({
                    message: "✅ Booking + Ticket Generated!",
                    booking_id: bookingId,
                    ticket_number: ticketNumber,
                    seat_no: seatNo
                });
            });
        }
    );
});


/* ✅ GET API — Fetch Booking by ID */
app.get("/bookings/:id", (req, res) => {
    const bookingId = req.params.id;

    const sql = "SELECT * FROM bookings WHERE booking_id = ?";

    db.query(sql, [bookingId], (err, results) => {
        if (err) return res.status(500).json({ error: "Error fetching booking" });
        if (results.length === 0) return res.status(404).json({ error: "Booking not found" });

        res.json(results[0]);
    });
});

app.get("/tickets/:id", (req, res) => {
    const bookingId = req.params.id;

    db.query(
        "SELECT * FROM tickets WHERE booking_id = ?",
        [bookingId],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });
            if (result.length === 0) {
                return res.status(404).json({ message: "No ticket found" });
            }
            res.json(result[0]);
        }
    );
});



/* ✅ DOWNLOAD PROFESSIONAL TICKET PDF */
app.get("/download/:id", (req, res) => {
    const bookingId = req.params.id;
    const sql = "SELECT * FROM bookings WHERE booking_id = ?";

    db.query(sql, [bookingId], async (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: "Booking not found" });
        
        const t = results[0];
        const qrData = await QRCode.toDataURL(`BookingID:${t.booking_id}|Flight:${t.flight_no}|Passenger:${t.passenger_name}`);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=SkyHighTicket-${bookingId}.pdf`);

        const doc = new PDFDocument({ size: 'A4', margin: 0 });
        doc.pipe(res);

        // Header Background - Gradient Effect
        doc.rect(0, 0, 595, 120).fill('#0a2440');
        doc.rect(0, 120, 595, 8).fill('#ff6b00');

        // Airline Logo & Title
        doc.fontSize(36).fillColor('#ffffff').font('Helvetica-Bold')
           .text('SkyHigh Airlines', 0, 35, { align: 'center' });
        doc.fontSize(14).fillColor('#e0e0e0').font('Helvetica')
           .text('E-TICKET & BOARDING PASS', 0, 80, { align: 'center' });

        // Main Ticket Container with Border
        const ticketY = 160;
        doc.roundedRect(40, ticketY, 515, 420, 15)
           .lineWidth(3)
           .strokeColor('#0a2440')
           .stroke();

        // Booking ID Badge
        doc.roundedRect(60, ticketY + 25, 240, 50, 8)
           .fill('#667eea');
        doc.fontSize(12).fillColor('#ffffff').font('Helvetica')
           .text('BOOKING REFERENCE', 70, ticketY + 35);
        doc.fontSize(22).font('Helvetica-Bold')
           .text(`#${t.booking_id}`, 70, ticketY + 52);

        // QR Code with Border
        doc.roundedRect(405, ticketY + 25, 130, 130, 8)
           .lineWidth(2)
           .strokeColor('#e0e0e0')
           .stroke();
        doc.image(qrData, 415, ticketY + 35, { width: 110 });
        doc.fontSize(9).fillColor('#666666').font('Helvetica')
           .text('Scan for Details', 415, ticketY + 150, { width: 110, align: 'center' });

        // Passenger Information Section
        let currentY = ticketY + 100;
        
        // Section Header
        doc.fontSize(14).fillColor('#0a2440').font('Helvetica-Bold')
           .text('PASSENGER INFORMATION', 60, currentY);
        doc.moveTo(60, currentY + 20).lineTo(380, currentY + 20)
           .strokeColor('#ff6b00').lineWidth(2).stroke();
        
        currentY += 35;

        // Helper function for info rows with icons
        const addInfoRow = (icon, label, value, y) => {
            doc.fontSize(11).fillColor('#666666').font('Helvetica')
               .text(icon, 60, y);
            doc.fontSize(10).fillColor('#666666').font('Helvetica-Bold')
               .text(label, 85, y);
            doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold')
               .text(value, 220, y, { width: 160 });
        };

        addInfoRow('👤', 'Passenger Name', t.passenger_name.toUpperCase(), currentY);
        currentY += 30;
        addInfoRow('📧', 'Email', t.email, currentY);
        currentY += 30;
        addInfoRow('📱', 'Phone', t.phone, currentY);
        currentY += 40;

        // Flight Details Section
        doc.fontSize(14).fillColor('#0a2440').font('Helvetica-Bold')
           .text('FLIGHT DETAILS', 60, currentY);
        doc.moveTo(60, currentY + 20).lineTo(380, currentY + 20)
           .strokeColor('#ff6b00').lineWidth(2).stroke();
        
        currentY += 35;

        addInfoRow('✈️', 'Flight Number', t.flight_no, currentY);
        currentY += 30;
        addInfoRow('🛫', 'Departure', t.source, currentY);
        currentY += 30;
        addInfoRow('🛬', 'Arrival', t.destination, currentY);
        currentY += 30;
        
        // Format date nicely
        const travelDate = new Date(t.travel_date);
        const formattedDate = travelDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        addInfoRow('📅', 'Travel Date', formattedDate, currentY);
        currentY += 30;
        
        // Capitalize travel class
        const travelClass = t.travel_class.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        addInfoRow('💺', 'Class', travelClass, currentY);
        currentY += 30;
        addInfoRow('👥', 'Passengers', t.passengers.toString(), currentY);

        // Important Notice Box
        doc.roundedRect(40, 610, 515, 80, 10)
           .fillAndStroke('#fff8e1', '#ffa726');
        
        doc.fontSize(11).fillColor('#e65100').font('Helvetica-Bold')
           .text('⚠️ IMPORTANT NOTICE', 60, 625);
        doc.fontSize(9).fillColor('#5d4037').font('Helvetica')
           .text('• Please arrive at the airport at least 2 hours before departure', 60, 645)
           .text('• Carry a valid government-issued photo ID', 60, 660)
           .text('• Check-in closes 45 minutes before departure', 60, 675);

        // Footer
        doc.fontSize(10).fillColor('#666666').font('Helvetica')
           .text('Thank you for choosing SkyHigh Airlines. Have a pleasant journey!', 0, 720, { align: 'center' });
        doc.fontSize(8).fillColor('#999999')
           .text('For support: support@skyhigh.com | +1-800-SKYHIGH | www.skyhigh.com', 0, 740, { align: 'center' });
        
        // Barcode-style decoration at bottom
        doc.rect(0, 780, 595, 3).fill('#0a2440');
        doc.rect(0, 785, 595, 2).fill('#ff6b00');

        doc.end();
    });
});

/* ✅ GET ALL BOOKINGS - For Admin Dashboard */
app.get("/bookings/all", (req, res) => {
    const sql = "SELECT * FROM bookings ORDER BY booking_id DESC";
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: "Error fetching bookings" });
        res.json(results);
    });
});

/* ✅ USER LOGIN */
app.post("/user/login", (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: "Database error" });
        }

        if (result.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login success", user: result[0] });
    });
});



// ADMIN LOGIN
app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM admins WHERE username = ? AND password = ?";

    db.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        res.json({ message: "Admin login successful" });
    });
});

// ✅ Fetch Flights API
app.get("/flights", (req, res) => {
    const { source, destination } = req.query;

    let sql = "SELECT * FROM flights WHERE 1=1";
    const values = [];

    if (source) {
        sql += " AND source = ?";
        values.push(source);
    }
    if (destination) {
        sql += " AND destination = ?";
        values.push(destination);
    }

    db.query(sql, values, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});



// ✅ DELETE BOOKING
app.delete("/bookings/:id", (req, res) => {
    const bookingId = req.params.id;

    const sql = "DELETE FROM bookings WHERE booking_id = ?";

    db.query(sql, [bookingId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "Error deleting booking" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Booking not found" });
        }

        res.json({ message: "Booking deleted successfully" });
    });
});

app.put("/bookings/update/:id", (req, res) => {
    const bookingId = req.params.id;
    const { passenger_name, travel_class, email, phone, passengers } = req.body;

    const sql = `
        UPDATE bookings 
        SET passenger_name = ?, travel_class = ?, email = ?, phone = ?, passengers = ?
        WHERE booking_id = ?
    `;

    db.query(sql, [passenger_name, travel_class, email, phone, passengers, bookingId], 
        (err, result) => {
            if (err) return res.status(500).json({ error: "Update failed" });

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Booking not found" });
            }

            res.json({ message: "Booking updated successfully" });
        }
    );
});

app.get("/join/user-bookings", (req, res) => {
    const query = `
        SELECT 
            u.name AS user_name,
            u.email AS user_email,
            b.booking_id,
            b.flight_no,
            b.travel_date
        FROM users u
        JOIN bookings b 
            ON u.email = b.email
    `;

    db.query(query, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.get("/stats/total-bookings", (req, res) => {
  const sql = `SELECT COUNT(*) AS total_bookings FROM bookings`;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows[0]);
  });
});

app.get("/stats/class-wise-bookings", (req, res) => {
  const sql = `
      SELECT travel_class, COUNT(*) AS total
      FROM bookings
      GROUP BY travel_class
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.get("/stats/popular-destinations", (req, res) => {
  const sql = `
      SELECT destination, COUNT(*) AS total_flights
      FROM bookings
      GROUP BY destination
      ORDER BY total_flights DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.get("/stats/passenger-load", (req, res) => {
  const sql = `
      SELECT flight_no, SUM(passengers) AS total_passengers
      FROM bookings
      GROUP BY flight_no
      ORDER BY total_passengers DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});



app.get("/stats/max-passengers", (req, res) => {
  const sql = `SELECT MAX(passengers) AS max_passengers FROM bookings`;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows[0]);
  });
});


/* ✅ Start Server */
app.listen(5000, () => {
    console.log("🚀 Server running on http://localhost:5000");
});


