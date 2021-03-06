/*
	Terminal Kit
	
	Copyright (c) 2009 - 2017 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var exec = require( 'child_process' ).exec ;
var async = require( 'async-kit' ) ;

var termkit = require( './termkit.js' ) ;



// Try to guess the terminal without any async system call, using TERM and COLORTERM
exports.guessTerminal = function guessTerminal()
{
	var envVar , version ;
	
	var t256color = ( process.env.TERM && process.env.TERM.match( /256/ ) ) ||
		( process.env.COLORTERM && process.env.COLORTERM.match( /256/ ) ) ;
	var tTrueColor = process.env.COLORTERM && process.env.COLORTERM.match( /^(truecolor|24bits?)$/ ) ;
	
	var appId = process.env.COLORTERM && ! tTrueColor ? process.env.COLORTERM : process.env.TERM ;
	
	var ssh = process.env.SSH_CONNECTION ? true : false ;
	
	// safe is true if we are sure about our guess
	var safe = process.env.TERM && process.env.TERM !== 'xterm' && process.env.TERM !== 'xterm-256color' ;
	
	var generic = appId ;
	
	switch ( appId )
	{
		case 'xterm' :
		case 'xterm-256color' :
			if ( safe ) { break ; }
			
			if ( tTrueColor )
			{
				appId = generic = 'xterm-truecolor' ;
			}
			
			// Many terminal advertise them as xterm, we will try to guess some of them here,
			// using environment variable
			if ( process.env.VTE_VERSION )
			{
				version = parseInt( process.env.VTE_VERSION ) ;
				
				if ( version >= 3803 )
				{
					appId = t256color || tTrueColor ? 'gnome-256color' : 'gnome' ;
					safe = true ;
					break ;
				}
			}
			
			for ( envVar in process.env )
			{
				if ( envVar.match( /KONSOLE/ ) )
				{
					appId = t256color || tTrueColor ? 'konsole-256color' : 'konsole' ;
					safe = true ;
					break ;
				}
			}
			
			break ;
		
		case 'linux' :
		case 'aterm':
		case 'kuake':
		case 'tilda':
		case 'terminology':
		case 'wterm':
		case 'mrxvt':
			break ;
		case 'gnome':
		case 'gnome-256color':
		case 'gnome-terminal':
		case 'gnome-terminal-256color':
		case 'terminator':	// it uses gnome terminal lib
		case 'guake':	// same here
			appId = t256color || tTrueColor ? 'gnome-256color' : 'gnome' ;
			break ;
		case 'konsole' :
			appId = t256color || tTrueColor ? 'konsole-256color' : 'konsole' ;
			break ;
		case 'rxvt':
		case 'rxvt-xpm':
		case 'rxvt-unicode-256color':
		case 'urxvt256c':
		case 'urxvt256c-ml':
		case 'rxvt-unicode':
		case 'urxvt':
		case 'urxvt-ml':
			if ( process.env.TERM === 'rxvt' ) { appId = 'rxvt-256color' ; }
			else { appId = t256color || tTrueColor ? 'rxvt-256color' : 'rxvt' ; }
			break ;
		case 'xfce' :
		case 'xfce-terminal' :
		case 'xfce4-terminal' :
			appId = 'xfce' ;
			break ;
		case 'eterm':
		case 'Eterm':
			appId = t256color || tTrueColor ? 'eterm-256color' : 'eterm' ;
			break ;
		case 'atomic-terminal' :
			appId = 'atomic-terminal' ;
			break ;
		default :
			if ( ! appId ) { generic = 'unknown' ; }
			else { generic = appId = generic.toLowerCase() ; }
			break ;
	}
	
	return { appId: appId , safe: safe , generic: safe ? appId : generic , ssh: ssh } ;
} ;



// Work localy, do not work over SSH
exports.getParentTerminalInfo = function getParentTerminalInfo( callback )
{
	var appName , appId , pid = process.pid ;
	
	if ( process.env.SSH_CONNECTION )
	{
		callback( new Error( 'SSH connection detected, .getParentTerminalInfo() is useless in this context.' ) ) ;
		return ;
	}
	
	var t256color = ( process.env.TERM && process.env.TERM.match( /256/ ) ) ||
		( process.env.COLORTERM && process.env.COLORTERM.match( /256/ ) ) ;
	var tTrueColor = process.env.COLORTERM && process.env.COLORTERM.match( /^(truecolor|24bits?)$/ ) ;
	
	async.do( [
		function( asyncCallback ) {
			exec( 'ps -h -o ppid -p ' + pid , function( error , stdout ) {
				if ( error ) { asyncCallback( error ) ; return ; }
				pid = parseInt( stdout ) ;
				asyncCallback() ;
			} ) ;
		} ,
		function( asyncCallback ) {
			exec( 'ps -h -o comm -p ' + pid , function( error , stdout ) {
				if ( error ) { asyncCallback( error ) ; return ; }
				appName = stdout.trim() ;
				asyncCallback() ;
			} ) ;
		}
	] )
	.while( function( error , results , asyncCallback ) {
		
		if ( error ) { asyncCallback( error ) ; return ; }
		
		//console.log( 'found:' , appName , pid ) ;
		
		// Do NOT skip the first, there are case where the terminal may run directly node.js without any shell in between
		//if ( ++ loop <= 1 ) { asyncCallback( undefined , true ) ; return ; }
		
		switch ( appName )
		{
			case 'linux' :
			case 'xterm' :
			case 'konsole' :
			case 'gnome-terminal':
			case 'aterm':
			case 'guake':
			case 'kuake':
			case 'tilda':
			case 'terminology':
			case 'wterm':
			case 'mrxvt':
				appId = t256color || tTrueColor ? appName + '-256color' : appName ;
				break ;
			case 'atomic-terminal':
				appId = appName ;
				break ;
			case 'login':
				appName = 'linux' ;
				appId = appName ;
				break ;
			// Use terminator as gnome-terminal, since it uses the gnome-terminal renderer
			case 'terminator':
				appId = t256color || tTrueColor ? 'gnome-256color' : 'gnome' ;
				break ;
			// Use rxvt as xterm-256color
			case 'rxvt':
			case 'urxvt256c':
			case 'urxvt256c-ml':
				appId = 'rxvt-256color' ;
				break ;
			// Use rxvt as xterm
			case 'urxvt':
			case 'urxvt-ml':
				appId = 'rxvt' ;
				break ;
			// xfce4-terminal
			case 'xfce4-terminal' :
				appId = 'xfce' ;
				break ;
			case 'gnome-terminal-':
				appName = 'gnome-terminal' ;
				appId = t256color || tTrueColor ? 'gnome-256color' : 'gnome' ;
				break ;
			case 'Eterm':
			case 'eterm':
				appName = 'Eterm' ;
				appId = t256color || tTrueColor ? 'eterm-256color' : 'eterm' ;
				break ;
			default :
				
				if ( appName.match( /gnome-terminal/ ) )
				{
					appName = 'gnome-terminal' ;
					appId = t256color || tTrueColor ? 'gnome-256color' : 'gnome' ;
					break ;
				}
				
				if ( ! pid || pid === 1 ) { asyncCallback( new Error( 'Terminal not found' ) ) ; }
				else { asyncCallback( undefined , true ) ; }
				return ;
		}
		
		asyncCallback( undefined , false ) ;
	} )
	.exec( function( error ) {
		if ( error ) { callback( error ) ; return ; }
		callback( undefined , { appId: appId , appName: appName , pid: pid , safe: true } ) ;
	} ) ;
} ;



// Work locally, do not work over SSH
exports.getDetectedTerminal = function getDetectedTerminal( callback )
{
	var guessed = termkit.guessTerminal() ;
	
	if ( guessed.safe || guessed.ssh )
	{
		// If we have a good guess, use it now
		callback( undefined , termkit.createTerminal( {
			stdin: process.stdin ,
			stdout: process.stdout ,
			stderr: process.stderr ,
			generic: ( process.env.TERM && process.env.TERM.toLowerCase() ) || 'unknown' ,
			appId: guessed.safe ? guessed.appId : undefined ,
			//  appName: guessed.safe ? guessed.appName : undefined ,
			processSigwinch: true ,
			preferProcessSigwinch: !! termkit.globalConfig.preferProcessSigwinch
			// couldTTY: true
		} ) ) ;
		
		return ;
	}
	
	termkit.getParentTerminalInfo( function( error , info ) {
		
		if ( error )
		{
			// Do not issue error
			callback( undefined , termkit.createTerminal( {
				stdin: process.stdin ,
				stdout: process.stdout ,
				stderr: process.stderr ,
				generic: ( process.env.TERM && process.env.TERM.toLowerCase() ) || 'unknown' ,
				appId: guessed.safe ? guessed.appId : undefined ,
				//  appName: guessed.safe ? guessed.appName : undefined ,
				processSigwinch: true ,
				preferProcessSigwinch: !! termkit.globalConfig.preferProcessSigwinch
				// couldTTY: true
			} ) ) ;
			
			return ;
		}
		
		callback( undefined , termkit.createTerminal( {
			stdin: process.stdin ,
			stdout: process.stdout ,
			stderr: process.stderr ,
			generic: ( process.env.TERM && process.env.TERM.toLowerCase() ) || 'unknown' ,
			appId: info.appId ,
			appName: info.appName ,
			pid: info.pid ,
			processSigwinch: true ,
			preferProcessSigwinch: !! termkit.globalConfig.preferProcessSigwinch
		} ) ) ;
	} ) ;
} ;
