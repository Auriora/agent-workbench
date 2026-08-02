route_prefix = :checkout

Rails.application.routes.draw do
  resources :checkouts
  resource :session
  get "/checkout/:id", to: "checkouts#show"
  post "/checkout", to: "checkouts#create"
  match "/legacy", to: "checkouts#legacy", via: :all
  get "/computed", to: route_prefix
  resources route_prefix
  namespace :admin do
    resources :checkouts
    get "/checkout/:id" => "checkouts#show"
  end
  get "/admin/widgets/:id" => "admin/widgets#show"
end
