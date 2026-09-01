const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://oditechglobal_db_user:Mithun%23824@oditechglobal.1o1lzph.mongodb.net/Oditechglobal_Teams?retryWrites=true&w=majority&appName=oditechglobal').then(async () => {
  const Message = mongoose.model('Message', new mongoose.Schema({
    conversationId: mongoose.Schema.Types.ObjectId,
    senderId: mongoose.Schema.Types.ObjectId,
    readBy: [mongoose.Schema.Types.ObjectId],
    status: String,
    messageStatus: String
  }));
  const id1 = new mongoose.Types.ObjectId();
  const id2 = new mongoose.Types.ObjectId();
  await Message.create({ conversationId: id1, senderId: id1, readBy: [] });
  const doc = await Message.findOne({ conversationId: id1 });
  
  await Message.updateMany(
    { _id: doc._id },
    { $addToSet: { readBy: id2.toString() } }
  );
  
  const docAfter = await Message.findOne({ conversationId: id1 });
  console.log('readBy after addToSet:', JSON.stringify(docAfter.readBy));
  
  const count = await Message.countDocuments({
    readBy: { $ne: id2.toString() }
  });
  console.log('Count for $ne id2 (should be 0 since id2 is in readBy):', count);
  
  process.exit(0);
});
