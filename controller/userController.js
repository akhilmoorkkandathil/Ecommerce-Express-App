
const userModel = require('../model/userSchema')
const productModel=require('../model/productSchema')
const categoryModel=require('../model/categorySchema')
const otpModel = require("../model/userOtpModel");
const bcrypt = require('bcrypt')
require("dotenv").config()
const session = require('express-session')
const twilioClient = require('../config/twilioService');
const {
    nameValid,
    emailValid,
    phoneValid,
    confirmpasswordValid,
    passwordValid,
    onlyNumbers,

  } = require("../utils/Validator");
const usersModel = require('../model/userSchema');
const cartModel = require('../model/cartSchema')
let objectId = require('mongodb').ObjectId;
const coupenModel=require('../model/coupenSchema')


//const errorHandler = require('../middlewares/errorhandlerMiddleware')




const createOrder = async (req, res) => {
  console.log('body:', req.body);
  var options = {
      amount: 500,
      currency: "INR",
      receipt: "order_rcpt"
  };
  instance.orders.create(options, function (err, order) {
      console.log("order1 :", order);
      res.send({ orderId: order.id})
    })
}

//@desc Home page
//@router Get /
//@acess public
const home = async(req,res)=>{
  
    try {
      const newProducts = await productModel.find({ status: true })
      .sort({ _id: -1 }) // Sort in descending order based on createdAt field
      .limit(3); // Limit the results to 3
      let newobj=[]
      let newmaps =newProducts.map((iteam)=>{
      let test={
        "_id":iteam._id,
        "name":iteam.name,
        "price":iteam.price,
        "images":iteam.images,
      }
      newobj.push(test)
      })

      const categories = await categoryModel.find({status:true})
      //console.log(categories);
      let arr=[]
      let map =categories.map((cat)=>{
      let val={
      name:cat.name
      }
      arr.push(val)

      })
      const products = await productModel.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "category",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        {
          $unwind: "$categoryDetails"
        },
        {
          $group: {
            _id: "$category",
            categoryName: { $first: "$categoryDetails.name" },
            products: { $push: "$$ROOT" }
          }
        },
        {
          $project: {
            _id: 1,
            categoryName: 1,
            products: { $slice: ["$products", 4] }
          }
        },
        {
          $project: {
            category: "$_id",
            categoryName: 1,
            products: {
              $map: {
                input: "$products",
                as: "product",
                in: {
                  _id: "$$product._id",
                  name: "$$product.name",
                  images: "$$product.images",
                  price: "$$product.price"
                }
              }
            }
          }
        }
      ]);
      console.log(products);
      let obj = [];
      products.map((iteam)=>{
        let test={
          "category":iteam.categoryName,
          "products":iteam.products,
          
        }
        obj.push(test)
        })
        console.log(obj);
      if(req.session.isAuth ===true){
     
      await res.render('./user/home',{login:true,newproducts:newobj,categories:arr,products:obj})
      }else{
      await res.render('./user/home',{newproducts:newobj,categories:arr,products:obj})
      }   
      
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    } 
}



//@desc Login page
//@router Get /login
//@acess public
const login = async(req,res)=>{
    try {
     
      await res.render('./user/login',{Single:true})
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
}


//@desc Register page
//@router Get /register
//@acess public
const register = async(req,res)=>{
    try {
      res.render('./user/register',{Single:true})
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
}


const optPage =async (req, res) => {
    try {
        res.render("./user/otpVerification",{Single:true});
    } catch {
      res.status(200).send("error occured");
    }
  };


//generate otp
const generateotp = () => {
    return Math.floor(100000 + Math.random() * 900000); // Generate a random 6-digit OTP
};



//send otp
const sendOTP = async (phoneNumber, otp) => {
    try {
        const message = await twilioClient.messages.create({
            body: `Your OTP for verification is: ${otp}`,
            from: '+1 912 228 4094',
            to: "+91 8590948623"
        });
        console.log("sended"+message.sid); // Log the message SID upon successful sending
    } catch (error) {
        console.error(error); // Handle error if message sending fails
        throw new Error("Failed to send OTP");
    }
};


const phonePage=async(req,res)=>{
  res.render('./user/phonePage',{Single:true})
}

const verifyNumber = async(req,res)=>{
  try {
    const number=req.body.phone
    req.session.phone=number
    const user = await userModel.findOne({ phone: number ,status:true });
    if (!user) {
      req.flash("error", "No user with this phone number");
      return res.redirect('/forgot')
    }else{
      const otp = generateotp();
            console.log(otp);
            const currentTimestamp = Date.now();
            const expiryTimestamp = currentTimestamp + 60 * 1000;
            const filter = { phone: number };
            const update = {
              $set: {
                phone: number,
                otp: otp,
                expiry: new Date(expiryTimestamp),
              },
            };
          
      
            const options = { upsert: true };
      
            await otpModel.updateOne(filter, update, options);
            await sendOTP(number, otp);
            req.session.forgot=true
            req.session.user=user
            res.redirect("/forgototpverify");
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}

const resendOtp=async(req,res)=>{

  try {
    const otp = generateotp();
          console.log(otp);
          const currentTimestamp = Date.now();
          const expiryTimestamp = currentTimestamp + 60 * 1000;
          const number = 8590948623;
          const filter = { phone: number };
          const update = {
            $set: {
              phone: number,
              otp: otp,
              expiry: new Date(expiryTimestamp),
            },
          };
        
    
          const options = { upsert: true };
    
          await otpModel.updateOne(filter, update, options);
          await sendOTP(number, otp);
          res.render("./user/otpVerification",{Single:true});
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
}


//@desc signup a user
//@router Post /register
//@access public
const registerUser = async (req, res) => {
    try {
        const username = req.body.username;
        const email = req.body.email;
        const phone = req.body.phone;
        const password = req.body.password;
        const cpassword = req.body.confirm_password;
    
        const isusernameValid = nameValid(username);
        const isEmailValid = emailValid(email);
        const isPhoneValid = phoneValid(phone);
        const ispasswordValid = passwordValid(password);
        const iscpasswordValid = confirmpasswordValid(cpassword, password);

        const numberExist = await userModel.findOne({ phone: phone });
        const emailExist = await userModel.findOne({ email: email });
//put it as function
        if (!isusernameValid) {
          req.flash("error", "Enter a valid Name");
          return res.redirect('/register')
        } else if (!isEmailValid) {
          req.flash("error", "Enter a valid E-mail");
          return res.redirect('/register')
        } else if (!isPhoneValid) {
          req.flash("error", "Enter a valid Phone Number");
          return res.redirect('/register')
        } else if (!ispasswordValid) {
          req.flash("error", "Password should contain one (A, a, 2)");
          return res.redirect('/register')
        } else if (!iscpasswordValid) {
          req.flash("error", "Password and Confirm password should match");
          return res.redirect('/register')
        } else if (numberExist) {
          req.flash("error", "This number already have an account");
          return res.redirect('/register')
        } else if (emailExist) {
          req.flash("error", "This email already have an account");
          return res.redirect('/register')
        } else {
          const hashedpassword = await bcrypt.hash(password, 10);
          const user = new userModel({
            username: username,
            email: email,
            phone: phone,
            password: hashedpassword,
            status:true
          });
           req.session.user = user;
           req.session.signup = true;
           req.session.forgot = false;
           console.log(req.session.user);

          const otp = generateotp();
          console.log(otp);
          const currentTimestamp = Date.now();
          const expiryTimestamp = currentTimestamp + 60 * 1000;
          const filter = { phone: phone };
          const update = {
            $set: {
              phone: phone,
              otp: otp,
              expiry: new Date(expiryTimestamp),
            },
          };
        
    
          const options = { upsert: true };
    
          await otpModel.updateOne(filter, update, options);
          await sendOTP(phone, otp);
          res.redirect("/verifyotp");
        } 
      }catch (err) {
        console.error("Error:", err);
        res.send("error");
      }
    
};



// otp verifying page 
const verifyotp = async (req, res) => {
    try {
        const enteredotp = req.body.otp;
        const eotp=parseInt(enteredotp)
        const user = req.session.user;
        const phone = req.session.user.phone;
        const userdb = await otpModel.findOne({ phone: phone });
        const otp = userdb.otp;
        console.log(eotp,otp);
        const expiry = userdb.expiry;
        if(eotp!==otp){
          req.flash("error", "Incorrect OTP");
          return res.redirect('/verifyotp')
        }else if (enteredotp == otp ) {
          user.isVerified = true;

          try {
            if (req.session.signup) {
              console.log(req.session.signup);
              await userModel.create(user);
              req.session.signup = false;
              res.redirect("/");
            } else if (req.session.forgot) {
              console.log(req.session.forgot);
              res.redirect("/newpassword");
            }
          } catch (error) {
            console.error(error);
            res.status(500).send("Error occurred while saving user data");
          }
        } else {
          res.render("users/otp",{otperror:"Worng password/Time expired"});
        }
     
    } catch (error) {
      console.log(err);
      res.status(500).send("error occured");
    }
  };


  const newPassword=async(req,res)=>{
    res.render('./user/newPassword',{Single:true})
  }

  const setNewPassword = async(req,res)=>{
    try {
      const password = req.body.password;
    const cpassword = req.body.confirm_password;
    const ispasswordValid = passwordValid(password);
    const iscpasswordValid = confirmpasswordValid(cpassword, password);

    if (!ispasswordValid) {
      req.flash("error", "Password should contain one (A, a, 2)");
      return res.redirect('/register')
    } else if (!iscpasswordValid) {
      req.flash("error", "Password and Confirm password should match");
      return res.redirect('/register')
    }else{
      
      const hashedpassword = await bcrypt.hash(password, 10)
            const phone = req.session.user.phone;
            console.log(phone);
            await userModel.updateOne({phone:phone},{password:hashedpassword})
            req.session.newpasspressed=false
            res.redirect('/login')

    }
    } catch (error) {
      console.log(error);
    }
  }



//@desc login a user
//@router Post /login
//@access public
const loginUser = async (req, res) => {
    
    try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email:email,status:true });
    if (!email || !password) {
        req.flash("error", "Enter Email & Password");
        return res.redirect('/login')
    }

   
        
        if (!user) {
            req.flash("error", "Invalid username or Password");
            return res.redirect('/login')
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          req.flash("error", "Invalid username or Password");
          return res.redirect('/login')
        }
          req.session.isAuth = true;
          req.session.user = user;
          req.session.userId=user._id;
          res.redirect('/')
        
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};



const loginHome= async (req, res) => {
   try {
        
        const newProducts = await productModel.find({ status: true })
                                  .sort({ _id: -1 }) // Sort in descending order based on createdAt field
                                  .limit(3); // Limit the results to 3
                    let newobj=[]
                        let newmaps =newProducts.map((iteam)=>{
                            let test={
                              "_id":iteam._id,
                                "name":iteam.name,
                                "price":iteam.price,
                                "images":iteam.images,
                            }
                            newobj.push(test)
                        })
          const categories = await categoryModel.find({status:true})
          let arr=[]
          let map =categories.map((cat)=>{
            let val={
              name:cat.name
            }
            arr.push(val)
          })
          req.session.isAuth = true;
        
        await res.render('./user/home',{login:true,newproducts:newobj})
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};


const shopProduct = async (req,res)=>{
  try {
    let limit =8;
   let pageNUmber = req.query.page-1 || 0;
   let skip = pageNUmber*limit;

   // Sorting options
   let sortOption = {};
   if (req.query.sort) {
     const sortOrder = req.query.sort === 'des' ? -1 : 1;
     sortOption = { price: sortOrder };
   }

   

   let searchQuery = {};
    if (req.query.search) {
      searchQuery = {
        $or: [
          { name: { $regex: new RegExp(req.query.search, 'i') } },
          { description: { $regex: new RegExp(req.query.search, 'i') } },
          {category: { $regex: new RegExp(req.query.search, 'i')}},
        ],
      };
    }
    // Filtering options
   let filterOption = {};
   if (req.query.category) {
     filterOption = { category: req.query.category };
   }
    const product = await productModel
    .find({ status: true, ...filterOption, ...searchQuery })
    .skip(skip)
    .limit(limit)
    .sort(sortOption) // Apply sorting here
   
        let obj=[]
            let maps =product.map((iteam)=>{
                let test={
                  "_id":iteam._id,
                    "name":iteam.name,
                    "price":iteam.price,
                    "images":iteam.images,
                }
                obj.push(test)
            })
            const products = await productModel.find({status:true, ...filterOption, ...searchQuery }).count()
            let pageCount=parseInt((products/limit)+1)
            let a=[]
            for(let i=1;i<=pageCount;i++){
              a.push(i)
            }
          const category = await categoryModel.find()
          let arr=[]
          let map = category.map((item)=>{
            let test = {
              "name":item.name
            }
            arr.push(test);
          })
         
          
    await res.render('./user/shop',{products:obj,name:"Shop",login:req.session.user,pages:a,pageNUmber,category:arr})
  } catch (error) {
    res.redirect('/error')
    console.log(error);
  }
}


const catProduct = async (req,res)=>{
  try {
    let cat = req.params.cat;
  const product = await productModel.find({status:true,category:cat})
        let obj=[]
            let maps =product.map((iteam)=>{
                let test={
                  "_id":iteam._id,
                    "name":iteam.name,
                    "price":iteam.price,
                    "images":iteam.images,
                    
                }
                obj.push(test)
            })
        
    await res.render('./user/shop',{products:obj,name:cat})
  } catch (error) {
    console.log(error);
    res.redirect('/error')
  }
}


const productPage =async (req,res)=>{
  try {
    const id = req.params.id;
  const user = req.session.user
  const products = await productModel.find({ _id: id})
   console.log(products);
        let obj=[]
            let maps =products.map((item)=>{
                let test={
                    "_id":item._id,
                    "name":item.name,
                    "price":item.price,
                    "category":item.category,
                    "images":item.images.slice(0, 6),
                    "stock":item.stock,
                    "status":item.status,
                    "description":item.description
                }
                obj.push(test)
            })
            console.log(obj);
  await res.render('./user/productPage',{products:obj})
  } catch (error) {
    console.log(error);
  }
}

const logOut = async (req, res) => {
  try {
      req.session.isAuth = false;
      res.clearCookie('myCookie');
      req.session.destroy();
      res.redirect("/");
    
  } catch (error) {
    console.log("error");
    res.send("Error Occured");
  }
};
const errorPage = async (req,res) => {
  await res.render('./user/errorPage',{Single:true})
}
const addAddress = async (req,res)=>{
  await res.render('./user/addAddress',{name:"Add Address"})
}

const myAddress =async(req,res)=>{
  const user = req.session.user;
  let login = req.session.isAuth;
  await res.render('./user/myAddress',{user,login})
}

const toAddAddress =async (req,res)=>{
  try {
    const { fname,lname,phone,pincode,locality,address,city,state,landmark,altphone,country} = req.body;
    const fnameValid = nameValid(fname);
        const pinValid = onlyNumbers(pincode);
        const isPhoneValid = phoneValid(phone);
        const isaltPhoneValid = phoneValid(altphone);
        
        const isLocalityValid = nameValid(locality)
        const islandmarkValid = nameValid(country)
        if (!fnameValid) {
          req.flash("error", "Enter a valid First Name");
          return res.redirect('/addAddress')
        } else if (!pinValid) {
          req.flash("error", "Enter a valid Pincode");
          return res.redirect('/addAddress')
        } else if (!isLocalityValid) {
          req.flash("error", "Enter a valid Locality");
          return res.redirect('/addAddress')
        }else if (!isPhoneValid) {
          req.flash("error", "Enter a valid Phone Nummber");
          return res.redirect('/addAddress')
        } else if (!isaltPhoneValid) {
          req.flash("error", "Enter valid alternative Phone Nummber");
          return res.redirect('/addAddress')
        } else if (!islandmarkValid) {
          req.flash("error", "Enter valid Landmark");
          return res.redirect('/addAddress')
        }
    const userId = req.session.userId;
    console.log(userId);
    const user = await userModel.findById(userId);
    console.log(user);
    if (user) {
      user.address.push({
        fname: fname,
        lname: lname,
        address: address,
        locality: locality,
        pincode: pincode,
        city: city,
        state: state,
        country: country,
        phone: phone,
        altphone: altphone,
        landmark: landmark,
      });

      // Save the updated user document
      await user.save();
    }
    req.session.user=user;
    if(req.session.checkout){
      req.session.isAuth=true
      await res.redirect('/checkout')
      req.session.checkout=false;
    }else{
      req.session.isAuth=true
      await res.redirect('/address')

    }
  } catch (error) {
    console.log("Some errors");
    return res.redirect('/error')
  }
}


const editPage = async (req, res) => {
  try {
    let index = req.params.index; // Assuming 'index' is the parameter name you want to capture
    const user = req.session.user;
    console.log(user);
    console.log(user.address[index])
    req.session.isAuth=true
     res.render('./user/updateAddress', { login: true, address:user.address[index],index}); // Pass 'index' to the render function if needed
  } catch (error) {
    console.log("Error:", error);
    // Handle errors accordingly
  }
};

const updateAddress = async (req, res) => {

  try {
    console.log("==============");
    const index =req.params.index;
    const {
      fname,
      lname,
      phone,
      pincode,
      locality,
      address,
      city,
      state,
      landmark,
      altphone,
      country
    } = req.body;
    
    const userId = req.session.userId;
    console.log(userId);
    const update = await userModel.updateOne(
      { _id: userId },
      {
        $set: {
          [`address.${index}.fname`]: fname,
          [`address.${index}.lname`]: lname,
          [`address.${index}.pincode`]: pincode,
          [`address.${index}.locality`]: locality,
          [`address.${index}.address`]: address,
          [`address.${index}.altphone`]: altphone,
          [`address.${index}.city`]: city,
          [`address.${index}.state`]: state,
          [`address.${index}.country`]: country,
          [`address.${index}.phone`]: phone,
          [`address.${index}.landmark`]: landmark
        }
      }
    );
        
    console.log(update);
    const user = await userModel.findById(userId);
    req.session.user=user;
    req.session.isAuth=true;
    await res.redirect('/address');
  } catch (error) {
    console.error('Error updating address:', error);
    res.redirect('/error')
  }
};

const editUserDetails =async(req,res)=>{
  try {
    const address=req.session.user;
    req.session.isAuth=true
    res.render('./user/editUserDetails',{address});
    
  } catch (error) {
    res.redirect('/error')
  }
}

const updateUserAddress = async(req,res)=>{
  try {
    const {fname,lname,email}=req.body;
    const userId = req.session.userId;
    const username = fname + " " + lname;

    await usersModel.updateOne(
      { _id: userId },
      {
        $set: {
          username: username,
          email: email,
        }
      }
    );
    const user = await userModel.findById(userId);
    req.session.user=user;
    await res.redirect('/address');
  } catch (error) {
    res.redirect('/error')
  }
}

const deleteAddress = async (req, res) => {
  try {
    let userId = req.session.userId;
    let index = req.params.index;

    let user = req.session.user;
    user.address.splice(index, 1);
    req.session.user = user;

    let updatedUser = await userModel.findByIdAndUpdate(userId, { address: user.address }, { new: true });

    console.log('User updated successfully:', updatedUser);
    res.redirect('/address');
  } catch (error) {
    console.error('Error occurred while updating user:', error);
    // Handle error
    res.redirect('/error')
  }
};


const searchProducts = async (req, res) => {
  try {
    const searchQuery = req.body.searchProducts;

    // Search for products by name or description
    const productData = await productModel.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${searchQuery}`, "i") } },
        { description: { $regex: new RegExp(`^${searchQuery}`, "i") } },
      ],
    });

    if (productData) {
      return res.redirect(`/${productData._id}`);
    }

    // Search for categories by name
    const categoryData = await cartModel.findOne({
      name: { $regex: new RegExp(`^${searchQuery}`, "i") },
    });

    if (categoryData) {
      return res.redirect(`/shop?category=${categoryData._id}`);
    }

    // If neither product nor category found, redirect to home
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect('/error');
  }
};


const checkoutPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id;
    console.log(req.body);
    const quantity = req.body.quantity || 1;

    const cartItems = await cartModel.findOne({ userId: userId }).populate({
      path: 'item.productId',
      select: '_id name price stock',
  }).lean();
  console.log(cartItems);
  const availableCoupons = await coupenModel.find().lean();
  console.log(availableCoupons);

req.session.checkout=true;
  
    await res.render('./user/checkout',{user:user,cartItems:cartItems,login:req.session.user,availableCoupons:availableCoupons});
  } catch (error) {
    // Handle errors
    console.error(error);
    res.redirect('/error')
  }
};

const newDeliveryAddrres = async (req,res) =>{
  try {
    const index = req.params.index;
    const user = req.session.user;
    console.log(user);
    console.log(index);
    let deliveryAddress = user.address.splice(index,1)
    user.address.unshift(deliveryAddress[0])
    req.session.user=user;
    res.redirect('/checkout')
  } catch (error) {
    res.redirect('/error')
  }
}





module.exports = {registerUser,
  loginUser,home,login,
  register,verifyotp,optPage,
  shopProduct,productPage,logOut,
  catProduct,
  loginHome,phonePage,verifyNumber,
  newPassword,setNewPassword,
  resendOtp,addAddress,searchProducts,
  myAddress,toAddAddress,editPage,
  updateAddress,editUserDetails,
  updateUserAddress,deleteAddress,
  checkoutPage,errorPage,newDeliveryAddrres,createOrder}