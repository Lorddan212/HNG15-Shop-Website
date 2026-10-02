import type {Metadata} from 'next';
import {ShopProvider} from '@/components/shop-provider';
import {Header,Footer,Bag,Notice} from '@/components/chrome';
import './globals.css';
import './luxury.css';
export const metadata:Metadata={title:{default:'FolioVale — Good things begin on paper',template:'%s | FolioVale'},description:'Notebooks and undated planners for your everyday ideas. Explore the FolioVale paper collection.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><ShopProvider><a className="skip-link" href="#main">Skip to content</a><Header/><Notice/><main id="main">{children}</main><Footer/><Bag/></ShopProvider></body></html>;}
