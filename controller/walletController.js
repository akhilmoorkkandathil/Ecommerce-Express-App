const usersModel = require('../model/userSchema');
const walletModel = require('../model/walletSchema')

module.exports = {
  walletPage: async (req, res) => {
    console.log("===================");
    const userId = req.session.userId;
    console.log(userId);
    const user= await usersModel.findOne({_id:userId}).lean
    let wallet = await walletModel.findOne({ userId: userId });
    if (!wallet) {
      wallet = await walletModel.findOneAndUpdate(
        { userId: userId },
        { $setOnInsert: { userId: userId, wallet: 0 } }, // Initial balance of 0
        { upsert: true, new: true }
      ).lean;
    }
    console.log(wallet);
    console.log(user); // Make sure user is defined here
    res.render('./user/walletPage', { wallet: wallet, user: user,login:req.session.userId });
  }
  ,
    createWallet:async(req,res)=>{
        try {
            const userId = req.session.userId;
            let user = await walletModel
              .findOne({ userId: userId })
              .sort({ "walletTransactions.date": -1 });
        
            if (!user) {
              wallet = await walletModel.create({ userId: userId });
            }
        
        
            res.render("./user/wallet", {  wallet:wallet });
          } catch (err) {
            console.log(err);
            res.redirect('/error')
          }
    },
    addToWallet:async(req,res)=>{
        try {
            const userId = req.session.userId;
            const Amount = parseFloat(req.body.Amount);
            console.log(Amount);
            const wallet = await walletModel.findOne({ userId: userId });
                wallet.wallet += Amount;
                wallet.walletTransactions.push({
                  type: "Credited",
                  amount: Amount,
                  date: new Date(),
                });

    
    await wallet.save();
            
        
            res.redirect("/wallet");
          } catch (err) {
            console.log(err);
            res.redirect('/error')
          }
    },
    walletTransaction : async (req, res) => {
      try {
        console.log("iiiiide ethi mwone..........")
         const userId=req.session.userId
         const amount=req.body.amount 
         const user=await walletModel.findOne({userId:userId})
         console.log("user",user)
         console.log("amount",amount);
         const wallet=user.wallet
         console.log("wallet",wallet);
    
         if(user.wallet>=amount){
          user.wallet-=amount
          await user.save();
    
          const wallet=await walletModel.findOne({userId:userId})
          
          
              wallet.walletTransactions.push({type:"Debited",
              amount:amount,
              date:new Date()})
              await wallet.save();
          
          res.json({success:true})
         }
         else{
          res.json({success:false,message:"don't have enought money"})
         }
      }  catch (err) {
        console.log(err);
        res.redirect('/error')
    }
    }
    
}