const mongoose = require('mongoose');
const MemberModel = require("../Users/Member");

const ticketSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: MemberModel,
        required: true
    },
    ticket_id: { type: String, unique:true },
    ticket_no: { type: String,unique:true },
    ticket_date: { type: Date, default: Date.now },
    type_of_ticket: { type: String, },
    ticket_details: { type: String, },
    reference_id:{type: String,},
    reply_details: { type: String, default: null },
    ticket_status: { type: String, enum :["pending", "answered"] ,default: "pending" },
    SUBJECT: { type: String, }
}, { timestamps: true, collection: "ticket_tbl" });


const generateUniqueTicketNo = async () => {
    let ticketNo;
    let exists;
    do {
        ticketNo = String(Math.floor(100 + Math.random() * 900)); 
        exists = await mongoose.model('ticket_tbl').exists({ ticket_no: ticketNo });
    } while (exists);

    return ticketNo;
};


const generateNextTicketId = async () => {
    const lastTicket = await mongoose.model('ticket_tbl').findOne({}, {}, { sort: { createdAt: -1 } });
    const lastNumber = lastTicket && lastTicket.ticket_id ? parseInt(lastTicket.ticket_id.replace("TKT", ""), 10) : 0;
    return `TKT${String(lastNumber + 1).padStart(4, '0')}`;
};

ticketSchema.pre("save", async function (next) {
    try {
        if (!this.ticket_id) {
            this.ticket_id = await generateNextTicketId();
        }
        if (!this.ticket_no) {
            this.ticket_no = await generateUniqueTicketNo();
        }
        next();
    } catch (error) {
        next(error);
    }
});




const Ticket = mongoose.model('ticket_tbl', ticketSchema);

module.exports = Ticket;