import {firebaseConfig} from './firebase-config.js?v=3';
const account={
  status:'initializing',user:null,error:'',ready:false,
  signIn:async()=>{throw Error('Google sign-in is still initializing.');},
  signOut:async()=>{throw Error('Google sign-in is still initializing.');}
};
window.MacheteAuth=account;
const notify=()=>window.dispatchEvent(new Event('machete-auth-changed'));
const publicError=err=>{
  const code=err?.code||'';
  if(code==='auth/popup-closed-by-user'||code==='auth/cancelled-popup-request')return 'Google sign-in was cancelled.';
  if(code==='auth/popup-blocked')return 'The sign-in popup was blocked. Open Machete directly in Safari or allow popups.';
  if(code==='auth/unauthorized-domain')return 'Add downaironly.github.io to Firebase Authentication > Settings > Authorized domains.';
  if(code==='auth/operation-not-allowed')return 'Enable the Google provider in Firebase Authentication > Sign-in method.';
  if(code==='auth/network-request-failed')return 'Sign-in needs an internet connection.';
  return 'Google sign-in could not complete. '+(err?.message||code);
};
(async()=>{
  try{
    const [{initializeApp},{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,setPersistence,browserLocalPersistence,browserSessionPersistence}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js')
    ]);
    const firebase=initializeApp(firebaseConfig,'machete-google-auth');
    const auth=getAuth(firebase);
    try{await setPersistence(auth,browserLocalPersistence);}
    catch(err){
      console.warn('Machete: persistent auth unavailable, trying session persistence',err);
      await setPersistence(auth,browserSessionPersistence);
    }
    const provider=new GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    account.signIn=async()=>{
      try{return await signInWithPopup(auth,provider);}
      catch(error){throw new Error(publicError(error));}
    };
    account.signOut=()=>signOut(auth);
    onAuthStateChanged(auth,user=>{
      account.ready=true;
      account.status='ready';
      account.error='';
      account.user=user&&user.emailVerified?{
        uid:user.uid,email:user.email||'',displayName:user.displayName||''
      }:null;
      if(user&&!user.emailVerified){
        account.error='Your Google email must be verified before Machete can be opened.';
        signOut(auth).catch(console.warn);
      }
      notify();
    },error=>{
      account.ready=true;account.status='error';account.error=publicError(error);account.user=null;notify();
    });
  }catch(error){
    account.ready=true;account.status='error';account.error=publicError(error);account.user=null;notify();
  }
})();
