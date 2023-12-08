const loged=(req,res,next)=>{
    if(req.session.isAuth)
    {
        next()
    }
    else{
        res.render("users/signin");
    }
}


const logedToHome=(req,res,next)=>{
    if(req.session.isAuth)
    {
        next()
    }
    else{
        res.redirect("/");
    }
}
const forgot=(req,res,next)=>{
    if (req.session.forgot) {
        next()
    }
    else{
        res.redirect("/");
    }
}

const signforgot=(req,res,next)=>{
    if (req.session.signup || req.session.forgot) {
        next()
    }
    else{
        res.redirect("/");
    }
}






module.exports={
    loged,
    logedToHome,
    forgot,
    signforgot,
    
}