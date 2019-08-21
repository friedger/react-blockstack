import React, { Component, createContext, useState, useEffect, useContext } from 'react'
import { UserSession, AppConfig, Person } from 'blockstack';
import { Atom, swap, useAtom, deref} from "@dbeining/react-atom"
import { isNil, isEqual, isFunction, merge } from 'lodash'

const contextAtom = Atom.of({})

export function useBlockstack () {
  return( useAtom(contextAtom) )
}

export function setContext(update) {
  // use sparingly as it triggers all using components to update
  console.log("setContext")
  swap(contextAtom, state => merge({}, state, isFunction(update) ? update(state) : update))
}

function signIn(e) {
  const { userSession } = deref(contextAtom)
  const update = {signIn: null}
  setContext( update )
  userSession.redirectToSignIn();
}

function signOut(e) {
  const { userSession } = deref(contextAtom)
  const update = { userData: null,
                   signIn: signIn,
                   signOut: null,
                   person: null }
  setContext( update )
  userSession.signUserOut()
}

function handleAuthenticated (userData) {
  window.history.replaceState({}, document.title, "/")
  const update = { userData: userData,
                   person: new Person(userData.profile),
                   signIn: null,
                   signOut: signOut }
  setContext( update )
}

export function initBlockstackContext (options) {
  // Idempotent - mention in documentation!
  const { userSession } = deref(contextAtom)
  if (!userSession) {
    const userSession = new UserSession(options)
    const update = { userSession: userSession }
    setContext( update )
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then( handleAuthenticated )
    } else if (userSession.isUserSignedIn()) {
      handleAuthenticated (userSession.loadUserData())
    } else {
      setContext( { signIn: signIn })
    }
  }
}

export const BlockstackContext = createContext({userData: null,
                                                signIn: null,
                                                signOut: null})

export function Blockstack(props) {
   const context = useBlockstack()
   return <BlockstackContext.Provider value={context}>
            {props.children}
          </BlockstackContext.Provider>
}

/* Persistent Context */

function useStateWithLocalStorage (storageKey) {
  const stored = localStorage.getItem(storageKey)
  const content = (typeof stored != 'undefined') ? JSON.parse(stored) : null
  console.log("PERSISTENT local:", stored, typeof stored)
  const [value, setValue] = useState(content)
  React.useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(value || null));
  }, [value])
  return [value, setValue];
}

function useStateWithGaiaStorage (userSession, path) {
  const [value, setValue] = useState(null)
  console.log("PERSISTENT = ", value)
  // React roadmap is to support data loading with Suspense hook
  if ( isNil(value) ) {
    if (userSession.isUserSignedIn()) {
        userSession.getFile(path)
        .then(stored => {
             console.info("PERSISTENT Get:", path, value, stored)
             const content = !isNil(stored) ? JSON.parse(stored) : {}
             setValue(content)
            })
         .catch(err => {
           console.error("PERSISTENT Get Error:", err)
         })
      } else {
        console.warn("PERSISTENT Get Fail: user not yet logged in")
    }}
  // ##FIX: Saves initially loaded value (use updated React.Suspense hook when available)
  useEffect(() => {
    if ( !isNil(value) ) {
         if (!userSession.isUserSignedIn()) {
           console.warn("PERSISTENT Put Fail: user no longer logged in")
         } else {
           console.info("PERSISTENT Put:", path, JSON.stringify(value))
           userSession.putFile(path, JSON.stringify(value))
         }
    }},[value])
  return [value, setValue]
}

export function usePersistent (props){
    const version = props.version || 0
    const property = props.property
    const path = props.path || property
    const context = useContext(BlockstackContext)
    const { userSession, userData } = context
    const content = property ? context[property] : null
    const [stored, setStored] = props.local
                              ? useStateWithLocalStorage(path)
                              : useStateWithGaiaStorage(userSession, path)
    useEffect(() => {
      if (stored && !isEqual (content, stored)) {
          console.info("PERSISTENT Set:", content, stored)
          if (version != stored.version) {
            // ## Fix: better handling of version including migration
            console.error("Mismatching version in file", path, " - expected", version, "got", stored.version)
          }
          const entry = {}
          entry[property] = stored.content
          setContext(entry)
    }}, [stored])

    useEffect(() => {
          if (!isEqual (content, stored && stored.content)) {
            console.info("PERSISTENT save:", content, stored)
            setStored({version: version, property: property, content: content})
          } else {
            console.log("PERSISTENT noop:", content, stored)
          }
        }, [content])
    return ({stored: stored, })
}

export function Persistent (props) {
  // perhaps should only bind value to context for its children?
  // ##FIX: validate input properties, particularly props.property
  const result = usePersistent(props)
  const context = useContext(BlockstackContext)
  const property = props.property
  const content = property ? context[property] : null
  return (
    props.debug ?
    <div>
      <h1>Persistent {property}</h1>
      <p>Stored: { JSON.stringify( stored ) }</p>
      <p>Context: { JSON.stringify( content ) }</p>
    </div>
    :null)
}

/* External Dapps */

export function useAppManifest (appUri) {
    // null when pending
    const [value, setValue] = useState(null)
    // ## FIX bug: May start another request while pending for a response
    useEffect(() => {  // #FIX: consider useCallback instead
      try {
        const manifestUri = appUri + "/manifest.json"
        const controller = new AbortController()
        const cleanup = () => controller.abort()
        console.info("FETCHING:", manifestUri)
        fetch(manifestUri, {signal: controller.signal})
        .then ( response => {response.json().then( setValue )})
        .catch ( err => {console.warn("Failed to get manifest for:", appUri, err)
                         setValue({error: err})})
        // .finally (() => setValue({}))
        return (cleanup)
      } catch (err) {
        console.warn("Failed fetching when mounting:", err)
        setValue({error: err})
      }
    }, [appUri])
    return (value)
  }

/* Update document element class  */

export function AuthenticatedDocumentClass (props) {
    // declare a classname decorating the document element when authenticated
    const className = props.name
    const { userData } = useBlockstack()
    useEffect(() => {
      console.log("Updating documentElement classes to reflect signed in status:", !!userData)
      if (userData) {
          document.documentElement.classList.add(className)
          document.documentElement.classList.remove('reloading')
      } else {
          document.documentElement.classList.remove(className)
      }}, [userData])
    return (null)
    }

export default BlockstackContext
