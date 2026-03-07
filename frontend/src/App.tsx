import * as React from 'react';
import { BrowserRouter, Route, Switch } from "react-router-dom";
import './App.css';
import AdminDashboard from "./pages/AdminDashboard";
import Index from './pages/index';
import SignIn from './pages/signin';
import SignUp from "./pages/signup";
import AuthLayout from "./components/AuthLayout";
import PatientDashboard from "./pages/PatientDashboardPage";

function App() {

  return (
    <BrowserRouter>
        <Switch>
          <Route path="/admin-dashboard" component={AdminDashboard} />
          <Route path="/patient-dashboard" component={PatientDashboard} />
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
