import Inventory from './pages/Inventory';
import AddWatch from './pages/AddWatch';
import Layout from './Layout.jsx';


export const PAGES = {
    "Inventory": Inventory,
    "AddWatch": AddWatch,
}

export const pagesConfig = {
    mainPage: "Inventory",
    Pages: PAGES,
    Layout: Layout,
};