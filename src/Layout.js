import { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate, Link} from "react-router-dom";
import NoteList from "./NoteList";
import { v4 as uuidv4 } from "uuid";
import { currentDate } from "./utils";
import { GoogleLogin,googleLogout, useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const localStorageKey = "lotion-v1";

function Layout() {
  const navigate = useNavigate();
  const mainContainerRef = useRef(null);
  const [collapse, setCollapse] = useState(false);
  const [notes, setNotes] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [currentNote, setCurrentNote] = useState(-1);
  const [accessToken,setAccessToken] = useState(null);
  
  useEffect(() => {
    if (currentNote < 0) {
      return;
    }
    if (!editMode) {
      navigate(`/notes/${currentNote + 1}`);
      return;
    }
    navigate(`/notes/${currentNote + 1}/edit`);
  }, [notes]);

  // Google
  const [signedIn, setSignedIn] = useState(
    
    JSON.parse(localStorage.getItem('profile')) ?
    (true):(false)
    
  );
  const [ user, setUser ] = useState(
    JSON.parse(localStorage.getItem('user')) ?
    (JSON.parse(localStorage.getItem('user'))):([])
  );

  const [ profile, setProfile ] = useState(
    JSON.parse(localStorage.getItem('profile')) ? 

      (JSON.parse(localStorage.getItem('profile'))) : (null)
  );
  
  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setUser(codeResponse);
      localStorage.setItem('user', JSON.stringify(codeResponse));
    },
    onError: (error) => console.log('Login Failed:', error)
  });

  /// USE EFFECTS ///
  useEffect(() => {
    if (profile && user) {
      setAccessToken(user.access_token);
      localStorage.setItem('profile', JSON.stringify(profile));
      getNotes(profile,user.access_token);
    }

    if(!profile) {
      navigate("/");
      setAccessToken(null);
      setUser([]);
    }
  }, [profile])

  useEffect(() => {
    if (user && user.access_token) {
      axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${user.access_token}`, {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          Accept: 'application/json'
        }
      })
      .then((res) => {
        setProfile(res.data);
      })
      .catch((err) => {
        console.log(err);
      });
    }
  }, [user]);
  
  
  const logOut = () => {

    setSignedIn(false);
    googleLogout();
    setProfile(null);
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    setProfile(null);
    setUser([]);
  };


  /// FUNCTIONS ///
  const saveNote = async(note, index) => {
    setEditMode(false);
    note.body = note.body.replaceAll("<p><br></p>", "");
    setNotes([
      ...notes.slice(0, index),
      { ...note },
      ...notes.slice(index + 1),
    ]);
    setCurrentNote(index);
    setEditMode(false);

    const email = profile.email;

    await fetch(
      "https://kw7plb7x2s364zubzepspwewbq0mcztt.lambda-url.ca-central-1.on.aws/",

    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authentication": accessToken
      },
      body: JSON.stringify({...note, email: email}),
    }

    );

  };

  const deleteNote = async (index, user) => {
    const noteId = notes[index].id;
    const email = profile.email;
    
    {accessToken ? console.log(accessToken):console.log("not work")};
  
    await fetch(
      "https://rsyegodqj2gjpnvxly6yjbe54q0wnwjv.lambda-url.ca-central-1.on.aws/",

      {
        method:"DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authentication": accessToken
        },
        body: JSON.stringify(
          {id:noteId, email: email}
        ),
      });

    setNotes([...notes.slice(0, index), ...notes.slice(index + 1)]);
    setCurrentNote(0);
    setEditMode(false);
  };

  const getNotes = async (profile, aToken) => {
    console.log("In the process of getting notes...");
    
    const email = profile.email;
    const res = await fetch(
      `https://ctbkgtwmw4plqzjvkbc5x3qwce0ubaop.lambda-url.ca-central-1.on.aws?email=${email}`,
      {
        // mode:'no-cors',
        method: "GET",
        headers: {
          "Content-Type":"application/json",
          "Authentication": aToken
        }
      }
    ).then(data => res.json()).then(data =>
    setNotes(data.data || [])
  }

  const addNote = () => {
    setNotes([
      {
        id: uuidv4(),
        title: "Untitled",
        body: "",
        when: currentDate(),
      },
      ...notes,
    ]);
    setEditMode(true);
    setCurrentNote(0);
  };
  const [bgColor, setBgColor] = useState('white');
  const [color,setColor] = useState('black');

  const handleButtonClick = () => {
    setBgColor(bgColor === 'white' ? 'black' : 'white');
    setColor(color === 'black' ? 'white' : 'black')
  };
 
  return (
    <div >
      {profile ? (
        <div style={{ backgroundColor: bgColor, color: color}} id="container">
          <header>
            <aside>
              <button style={{color:color}} id="menu-button" onClick={() => setCollapse(!collapse)}>
                &#9776;
              </button>
              <button style={{width:'60px', color:color}} onClick={handleButtonClick}>&#9681;</button>
            </aside>
            <div id="app-header">
              <h1>
                <Link to="/notes">Motion ProMax</Link>
              </h1>
              <h6 id="app-moto">Like Motion, but better.</h6>
            </div>
            <div id="right">
              <div id="absolute">{signedIn ? profile.email : ""}</div>
              <button style={{color:color}}
                id={signedIn ? "log-out-button" : "log-out-button-hidden"}
                onClick={() => logOut()}
              >
                Log out
              </button>
            </div>
          </header>

          <div id="main-container" ref={mainContainerRef}>
            <aside id="sidebar" className={collapse ? "hidden" : null}>
              <header>
                <div id="notes-list-heading">
                  <h2>Notes</h2>
                  <button style={{color:color}} id="new-note-button" onClick={addNote}>
                    +
                  </button>
                </div>
              </header>
              <div id="notes-holder">
                <NoteList notes={notes} />
              </div>
            </aside>
            <div id="write-box">
              <Outlet context={[notes, saveNote, deleteNote]} />
            </div>
          </div>
        </div>
      ) : (
        <div id="LoginPage">
          <header>
            <aside>
              <button id="menu-button" onClick={() => setCollapse(!collapse)}>
                &#9776;
              </button>
              <button style={{width:'60px', color:color}} onClick={handleButtonClick}>&#9681;</button>
            </aside>
            <div id="app-header">
              <h1>
                <Link to="/notes">Motion proMax</Link>
              </h1>
              <h6 id="app-moto">Like Motion, but better.</h6>
            </div>
            <aside>&nbsp;</aside>
          </header>
          <div id="sign-in">
            <GoogleLogin
              onSuccess={() => {
                login();
                setSignedIn(true);
              }}
              onError={(error) => console.log("Login Failed:", error)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
export default Layout;