import * as React from 'react';
import { BrowserRouter, Route, Switch } from "react-router-dom";
import './App.css';
import Dashboard from "./pages/dashboard";
import Index from './pages/index';
import SignIn from './pages/signin';
import SignUp from "./pages/signup";
import AuthLayout from "./components/AuthLayout";

function App() {

  return (
    <BrowserRouter>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/signin" component={SignIn} />
          <Route path={["/", "/signup"]}>
            <AuthLayout>
              <Switch>
                <Route path="/" exact component={Index} />
                <Route path="/signup" component={SignUp} />
              </Switch>
            </AuthLayout>
          </Route>
        </Switch>
  </BrowserRouter>
  );
}

export default App;
