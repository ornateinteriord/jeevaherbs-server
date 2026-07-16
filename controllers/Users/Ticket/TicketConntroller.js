const Ticket = require("../../../models/Ticket/Ticket");

const createTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const memberId = req.user.memberId;
        const ticket = new Ticket({
        ...req.body,
        userId,
        reference_id: memberId
        });
        await ticket.save();
        res.status(201).json({success : true , message : "Ticket Created Successfully", ticket });
    } catch (error) {
        res.status(500).json({success : false , message: error.message });
    }
}

const getTickets = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role; 

        if (!userId) {
            return res.status(400).json({ success: false, message: "Invalid User" });
        }

        let tickets;
        if (userRole === 'ADMIN') {
            tickets = await Ticket.find();
        } else {
            if (id && id !== userId) {
                return res.status(403).json({ success: false, message: "Access Denied" });
            }
            tickets = await Ticket.find({ userId });
        }

        if (tickets.length === 0) {
            return res.status(404).json({ success: false, message: "No Tickets Found" });
        }

        res.status(200).json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

const editTicket = async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;
        const { reply_details } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: "Invalid User" });
        }

        const ticket = await Ticket.findById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: "Ticket Not Found" });
        }

        const updateFields = { reply_details };

        if (reply_details) {
            updateFields.ticket_status = "answered";
        }

        const updatedTicket = await Ticket.findByIdAndUpdate(
            id, 
            { $set: updateFields },
            { new: true } 
        );

        res.status(200).json({ success: true, message: "Ticket Updated Successfully", ticket: updatedTicket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


module.exports = { createTicket, getTickets, editTicket };