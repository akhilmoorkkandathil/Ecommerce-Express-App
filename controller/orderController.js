const cartModel = require('../model/cartSchema');
const { randomUUID } = require('crypto');
const orderModel = require('../model/orderModel')
const { default: ShortUniqueId } = require('short-unique-id');
const moment = require("moment");
let date = moment();
const Razorpay = require('razorpay');
const productModel = require('../model/productSchema');
const fs = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");
const walletModel=require('../model/walletSchema')

const razorpayInstance = new Razorpay({ 

// Replace with your key_id 
key_id: process.env.RZP_KEY_ID, 

// Replace with your key_secret 
key_secret: process.env.RZP_KEY_SECRET 
}); 



module.exports = {
orderPage: async(req,res ,next)=>{
    try {
      let page=req.query.page-1 || 0
      let limit=5;
      let skip=page*limit;
        const userId = req.session.userId;

        const orders = await orderModel.find({userId:userId}).sort({ createdAt: -1 , orderId: -1 }).skip(skip).limit(limit)
        let obj=[]
    let maps =orders.map((item)=>{
        let test={
            "orderId":item.orderId,
            "price":item.totalPrice,
            "status":item.status,
            "paymentMethod":item.paymentMethod,
            "createdAt":item.createdAt.toString().substring(0, 10),
        }
        obj.push(test)
    })
    const data = await orderModel.find({userId:userId});
    const length = data.length
    let i=1
    let pages=[]
    while(i<=(Math.ceil(length)/limit)){
      pages.push(i)
      i++
    }
    page>1?prev=page-1:prev=1
        page<Math.ceil(length/limit)?next=page+2:next=Math.ceil(length/limit)
        await res.render('./user/orderDetails',{login:req.session.user,orders:obj,pages:pages,prev,next})
    } catch (error) {
        console.log("Orders:",error);
       error.status = 500;
      next(error);
    }
},

placeOrder: async(req,res ,next) => {
    try {
        const {selectedPaymentOption} = req.body;
        const userId = req.session.userId;
        const user = req.session.user;
        const username = user.username;
        const uid = new ShortUniqueId();
        const selectedAddress = user.address[0];
        const cartProducts = await cartModel.find({userId:userId});
        const orderId=uid.randomUUID(6)
        
            const order = new orderModel({
                orderId: orderId,
                userId: req.session.userId,
                userName: username,
                items: cartProducts[0].item,
                totalPrice: req.session.price || cartProducts[0].total,
                shippingAddress: selectedAddress,
                paymentMethod: selectedPaymentOption,
                updatedAt: date.format("YYYY-MM-DD HH:mm"),
                createdAt: date.format("YYYY-MM-DD HH:mm"),
                status: "pending",
                
                });
                await order.save();
                await cartModel.updateOne({ userId: userId }, { $set: { item: [] } });
                
        if(selectedPaymentOption==="COD" || selectedPaymentOption==="Wallet"){
        res.redirect('/orderSuccess')

        }else{
            console.log("Rasorpay payment started");
            var options = {
                amount: req.session.price || cartProducts[0].total,  // amount in the smallest currency unit
                currency: "INR",
                receipt: orderId,
                };
                razorpayInstance.orders.create(options, function(err, order) {
                  res.redirect('/orderSuccess')
                
                });
            
        }
            
                
    } catch (error) {
        console.log(error);
       error.status = 500;
      next(error);
    }
},

delAdress: async (req,res ,next) => {
    try {
        console.log(req.body);
        res.redirect('/checkout')
    } catch (error) {
        console.log(error);
       error.status = 500;
      next(error);
    }
},
cacelOrder: async (req,res ,next) => {
    try {
      const userId = req.session.userId;
        const orderId = req.params.orderId;
        const reason = req.query.reason; 
        console.log(orderId,reason);
        const orders = await orderModel.find({orderId:orderId})
        console.log(orders);
        console.log("==============");
        const options = { upsert: true };
    if(orders[0].status==="pending" || orders[0].status==="Shipped"){
        const filter = { orderId: orderId};
        const update = { 
          status: "Cancelled",
          reason: req.query.reason 
      };
      const user = await walletModel.findOne({ userId: userId });
  
      const refund = orders[0].totalPrice;
      console.log("refundAmount", refund);
  
      const currentWallet = user.wallet;
      const newWallet = currentWallet + refund;
      const amountUpdate = await walletModel.updateOne(
        { userId: userId },
        {
          $set: { wallet: newWallet },
          $push: {
            walletTransactions: {
              date: new Date(),
              type: "Credited",
              amount: refund,
            },
          },
        }
      );
        await orderModel.updateOne(filter, { $set: update });
        await res.redirect('/orders')
    }else if(orders[0].status==="Delivered"){
        const filter = { orderId: orderId };
        const update = { 
          status: "Cancelled",
          reason: req.query.reason
      };
        await orderModel.updateOne(filter,  update ,options);
        await res.redirect('/orders');
    }else{
        await res.redirect('/orders');
    }
    } catch (error) {
        console.log(error);
       error.status = 500;
      next(error);
    }
},
orderShipped: async (req,res ,next) => {
try {
    const orderId = req.params.id;
    const order = await orderModel.find({orderId: orderId})
if(order[0].status==="pending"){
    const filter = { orderId: orderId};
    const update = { status: "Shipped" };
    await orderModel.updateOne(filter, { $set: update });
    await res.redirect('/admin/orders')
}else if(order[0].status==="Shipped"){
    const filter = { orderId: orderId };
    const update = { status: "Delivered" };
    req.session.returnOrder=true;
    await orderModel.updateOne(filter, { $set: update });
    await res.redirect('/admin/orders');
}else{
    await res.redirect('/admin/orders');
}
    
    } catch (error) {
        console.log(error);
        error.status = 500;
      next(error);
    }
},

viewOrderdProducts: async (req,res ,next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.userId;
        const orders = await orderModel.find({userId:userId,orderId:orderId})
        console.log(orders[0]);
        let maps =orders.map((item)=>{
            let test={
                "orderId":item.orderId,
                "price":item.totalPrice,
                "status":item.status,
                "paymentMethod":item.paymentMethod,
                "createdAt":item.createdAt.toString().substring(0, 10),
            }
            obj.push(test)
        })
        res.render('./user/orderedProducts',{order:orders,login:req.session.user})
    } catch (error) {
        console.log(error);
        error.status = 500;
      next(error);
    }
},

myOrders: async (req, res,next) => {
    try {
      const orderId = req.params.id;
      
      const result = await orderModel.aggregate([
        {
          $match: {
            orderId:orderId,
          },
        },
        {
          $unwind: "$items",
        },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        {
          $unwind: "$productDetails",
        },
        {
          $project: {
            _id: 1,
            orderId: 1,
            price:1,
            totalPrice:1,
            userName: 1,
            shippingAddress:1,
            productName: "$productDetails.name",
            images:"$productDetails.images",
            price: "$productDetails.price",
            quantity: "$items.quantity",
            purchaseDate: "$createdAt",
            status: "$status",
            reason:"$reason"
          },
        },
      ]);


      console.log(result);
      let obj=[]
      let maps =result.map((item)=>{
        let test={
          "orderId":item.orderId,
          "price":item.price,
          "totalPrice":item.totalPrice,
          "shippingAddress":item.shippingAddress,
            "productName":item.productName,
            "price":item.price,
            "status":item.status,
            "quantity":item.quantity,
            "purchaseDate":item.purchaseDate.toString().substring(0, 10),
            "image":item.images[0],
            "reason":item.reason
        }
        obj.push(test)
        //console.log(obj);
    })
    if(req.session.user){
        res.render('./user/eachOrderProducts',{orderedProducts:obj,login:req.session.user}); // Corrected typo in the redirect URL
    }else{
        res.render('./admin/eachOrderProducts',{orderedProducts:obj,Admin:true}); // Corrected typo in the redirect URL
    }
     
    } catch (error) {
      console.error(error);
      error.status = 500;
      next(error);
    }
  },
  

  returnOrder:async(req,res ,next)=>{
    try {
      const userId = req.session.userId;
      const id = req.params.id;
      const reason = req.query.reason; 
      console.log(reason);
      const update = await orderModel.updateOne(
        { orderId: id },
        { status: "Returned",reason:reason },
        {upsert:true}
      );
      const order = await orderModel.findOne({ orderId: id });
      const user = await walletModel.findOne({ userId: userId });
  
      const refund = order.totalPrice;
      console.log("refundAmount", refund);
  
      const currentWallet = user.wallet;
      const newWallet = currentWallet + refund;
      const amountUpdate = await walletModel.updateOne(
        { userId: userId },
        {
          $set: { wallet: newWallet },
          $push: {
            walletTransactions: {
              date: new Date(),
              type: "Credited",
              amount: refund,
            },
          },
        }
      );
  
      const result = await orderModel.findOne({ orderId: id });
  
      const items = result.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
      for (const item of items) {
        const product = await productModel.findOne({ _id: item.productId });
        product.stock += item.quantity;
        await product.save();
      }
  
      res.redirect("/orders");
    } catch (err) {
      console.log(err);
      error.status = 500;
      next(error);
    }
  },

orderSuccess : async (req,res ,next) => {
    try {
        res.render('./user/orderSuccess',{login:req.session.user})
    } catch (error) {
     error.status = 500;
      next(error);
    }
},
salesReport : async (req,res ,next)=> {
    try {
        const { startDate, endDate } = req.body;
    
        console.log(req.body);
          
         
        const payments = await orderModel.aggregate([
          {
            $match: {
              createdAt: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
              },
            },
          },
          {
            $match: { status: 'Delivered' }
        },
        {
            $group: {
                _id: '$paymentMethod',
                totalAmount: { $sum: '$totalPrice' }
            }
        }
        ]);
        const status = await orderModel.aggregate([
            {
              $match: {
                createdAt: {
                  $gte: new Date(startDate),
                  $lte: new Date(endDate),
                }
              },
            },
            {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 }
                }
              }
          ]);
        const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Sales Report</title>
                    <style>
                        body {
                            margin-left: 20px;
                        }
                    </style>
                </head>
                <body>
                    <h2 align="center"> Sales Report</h2>
                    Start Date: ${startDate}<br>
                    End Date: ${endDate}<br> 
                    <center>
                    <h3>Total Sales</h3>
                        <table style="border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th style="border: 1px solid #000; padding: 8px;">Sl N0</th>
                                    <th style="border: 1px solid #000; padding: 8px;">PaymentMethode</th>
                                    <th style="border: 1px solid #000; padding: 8px;">Amount Recieved</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments
                                  .map(
                                    (item, index) => `
                                    <tr>
                                        <td style="border: 1px solid #000; padding: 8px;">${
                                          index + 1
                                        }</td>
                                        <td style="border: 1px solid #000; padding: 8px;">${
                                          item._id
                                        }</td>
                                        <td style="border: 1px solid #000; padding: 8px;">${
                                          item.totalAmount
                                        }</td>
                                    </tr>`
                                  )
                                  }
                                    
                            </tbody>
                        </table>
                    </center>
                    <center>
                    <h3>Order Status</h3>
                        <table style="border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th style="border: 1px solid #000; padding: 8px;">Sl N0</th>
                                    <th style="border: 1px solid #000; padding: 8px;">Status</th>
                                    <th style="border: 1px solid #000; padding: 8px;">Total Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${status
                                  .map(
                                    (item, index) => `
                                    <tr>
                                        <td style="border: 1px solid #000; padding: 8px;">${
                                          index + 1
                                        }</td>
                                        <td style="border: 1px solid #000; padding: 8px;">${
                                          item._id
                                        }</td>
                                        <td style="border: 1px solid #000; padding: 8px;">${
                                          item.count
                                        }</td>
                                    </tr>`
                                  )
                                  }
                                    
                            </tbody>
                        </table>
                    </center>
                    
                </body>
                </html>
            `;
    
    const browser = await puppeteer.launch()
    const page = await browser.newPage();

    await page.setContent(htmlContent);

    // Generate PDF
    const pdfBuffer = await page.pdf();

    await browser.close();
        // Write PDF to file
const downloadsPath = path.join(os.homedir(), 'Downloads');
const pdfFilePath = path.join(downloadsPath, 'sales.pdf');

// Save the PDF file locally
 fs.writeFileSync(pdfFilePath, pdfBuffer);

        // Set response headers
res.setHeader("Content-Length", pdfBuffer.length);
res.setHeader("Content-Type", "application/pdf");
res.setHeader("Content-Disposition", "attachment; filename=sales.pdf");

// Send the PDF buffer as the response
res.status(200).send(pdfBuffer);
      } catch (error) {
        console.log(error);
        error.status = 500;
      next(error);
      }
},
 downloadInvoice : async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const order = await orderModel.findOne({ orderId: orderId });
    console.log(order);
    const formattedDate = order.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const products = await orderModel.aggregate([
      { $match: { orderId: orderId } }, // Match the order by orderId
      { 
        $unwind: "$items" // Deconstruct the items array
      },
      { 
        $lookup: {
          from: "products", // Collection name to lookup
          localField: "items.productId", // Field in the current collection (order) to match
          foreignField: "_id", // Field in the referenced collection (products) to match
          as: "product" // Output array field name
        }
      },
      {
        $addFields: {
          // Add product details to the item
          "items.productDetails": { $arrayElemAt: ["$product", 0] }
        }
      },
      {
        $project: {
          _id: 0, // Exclude _id field from output
          orderId: 1,
          userId: 1,
          userName: 1,
          "items.productId": 1,
          "items.quantity": 1,
          "items.total": 1,
          "items.productDetails.name": 1,
          "items.productDetails.price": 1,
          "items.productDetails.offerPrice": 1
        }
      }
    ]);
    
    console.log(products[0].items.productDetails);
    
    
    // Construct HTML content for the invoice based on order details
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Invoice</title>
          <style>
              /* Your CSS styles here */
              table {
                width: 100%;
                border-collapse: collapse;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f2f2f2;
              }
          </style>
      </head>
      <body>
      <h2>Order Invoice</h2>
      <p>Order ID: ${order.orderId}</p>
      <p>User Name: ${order.userName}</p>
      <p>Date of Purchase: ${formattedDate}</p>
      <p>Total Price: ${order.totalPrice}</p>
      <p><strong>Delivery Address</strong></p>
      <address>
  <p>${order.shippingAddress.fname} ${order.shippingAddress.lname}</p>
  <p>${order.shippingAddress.address}, ${order.shippingAddress.locality}, ${order.shippingAddress.city}</p>
  <p> ${order.shippingAddress.state} ${order.shippingAddress.pincode}, ${order.shippingAddress.country}</p>
  <p>Phone: ${order.shippingAddress.phone}</p>
</address>
      

<table>
  <thead>
    <tr>
      <th>Product Name</th>
      <th>Price</th>
      <th>Quantity</th>
      <th>Total</th>
    </tr>
  </thead>
  <tbody>
    ${products.map(product => `
      <tr>
        <td>${product.items.productDetails?.name}</td>
        <td>${product.items.productDetails?.price}</td>
        <td>${product.items.quantity}</td>
        <td>${product.items.total}</td>
      </tr>
    `).join('')}
  </tbody>
</table>


          <p>Total Price:<strong>${order.totalPrice}/-</strong> </p>
      </body>
      </html>
    `;
    const browser = await puppeteer.launch()

    const page = await browser.newPage();

    await page.setContent(htmlContent);


    // Generate PDF
    const pdfBuffer = await page.pdf();

    await browser.close();

    // Write PDF to file
const downloadsPath = path.join(os.homedir(), 'Downloads');
      const pdfFilePath = path.join(downloadsPath, 'sales.pdf');

// Save the PDF file locally
fs.writeFileSync(pdfFilePath, pdfBuffer);

    // Set response headers and send PDF as attachment
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=order_invoice.pdf");
    res.status(200).end(pdfBuffer);
  } catch (error) {
    console.log(error);
    error.status = 500;
    next(error);
  }
},
}